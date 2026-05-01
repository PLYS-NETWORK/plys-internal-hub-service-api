import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EnvironmentsService } from '@common/modules/environments';
import { IStorageProvider, IUploadInput, STORAGE_PROVIDER } from '@common/modules/file-storage';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { FileEntity } from '@database/entities';
import { FileStorageProvider, UserRole } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import * as crypto from 'crypto';

import { FileResponseDto } from './dto/responses';
import { IFilesService } from './interfaces';

@Injectable()
export class FilesService implements IFilesService {
  private readonly logger: AppLogger;

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly env: EnvironmentsService,
  ) {
    this.logger = new AppLogger(FilesService.name, requestContext);
  }

  /** @inheritdoc */
  public async upload(input: IUploadInput, opts?: { purpose?: string }): Promise<FileResponseDto> {
    const ownerUserId = this.requireUserId();
    this.logger.log(
      `upload — start | userId: ${ownerUserId}, size: ${input.size}, mime: ${input.mimeType}`,
    );

    if (this.storage.name === FileStorageProvider.LOCAL) {
      await this.assertWithinUserQuota(ownerUserId, input.size);
    }

    // Server-generated key — never derived from the client filename. Sharded
    // by yyyy/mm to avoid huge flat directories on the local provider.
    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const uuid = crypto.randomUUID();
    const keyHint = `${yyyy}/${mm}/${uuid}.${input.extension}`;

    const sha256 = crypto.createHash('sha256').update(input.buffer).digest('hex');

    let stored;
    try {
      stored = await this.storage.put(input, keyHint);
    } catch (err) {
      this.logger.error(
        `upload — provider.put failed | userId: ${ownerUserId}, error: ${(err as Error).message}`,
      );
      throw err instanceof TranslatableException
        ? err
        : new TranslatableException({
            messageKey: 'error.file.upload_failed',
            errorCode: ERROR_CODES.FILE_UPLOAD_FAILED,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
          });
    }

    const row = this.uow.files.create({
      ownerUserId,
      storageProvider: this.storage.name,
      storageKey: stored.key,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.size,
      sha256,
      purpose: opts?.purpose ?? null,
    });
    const saved = (await this.uow.files.save(row)) as FileEntity;

    this.logger.log(`upload — complete | id: ${saved.id}, key: ${stored.key}`);
    return this.toResponseDto(saved, stored.url);
  }

  /** @inheritdoc */
  public async getById(id: string): Promise<FileResponseDto> {
    const file = await this.loadOwnedOrThrow(id);
    const url = await this.storage.getUrl(file.storageKey);
    return this.toResponseDto(file, url);
  }

  /** @inheritdoc */
  public async remove(id: string): Promise<void> {
    const file = await this.loadOwnedOrThrow(id);
    this.logger.log(`remove — start | id: ${id}`);
    await this.uow.files.softDelete(file.id);
    this.logger.log(`remove — complete | id: ${id}`);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private requireUserId(): string {
    const userId = this.requestContext.userId;
    if (!userId) {
      throw new TranslatableException({
        messageKey: 'error.generic.unauthorized',
        errorCode: ERROR_CODES.GENERIC_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      });
    }
    return userId;
  }

  /**
   * Loads the file row with ownership enforced. Returns 404 (not 403) when
   * the caller doesn't own the file, matching the project's no-leak policy
   * for resource existence.
   */
  private async loadOwnedOrThrow(id: string): Promise<FileEntity> {
    const userId = this.requireUserId();
    const file = await this.uow.files.findByActiveId(id);
    const isAdmin = this.requestContext.userRole === UserRole.ADMIN_PLATFORM;
    if (!file || (!isAdmin && file.ownerUserId !== userId)) {
      this.logger.warn(`loadOwnedOrThrow — not found | id: ${id}, userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.file.not_found',
        errorCode: ERROR_CODES.FILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    return file;
  }

  /**
   * Asserts the user has headroom under both the byte-quota and the file-count
   * cap. Runs before the upload reaches the provider so we never write bytes
   * that we'd immediately have to roll back.
   */
  private async assertWithinUserQuota(ownerUserId: string, incoming: number): Promise<void> {
    const [usedBytes, count] = await Promise.all([
      this.uow.files.sumActiveBytesByOwner(ownerUserId),
      this.uow.files.countActiveByOwner(ownerUserId),
    ]);

    if (count + 1 > this.env.filesUserMaxCount) {
      this.logger.warn(`quota — file count cap reached | userId: ${ownerUserId}, count: ${count}`);
      throw new TranslatableException({
        messageKey: 'error.file.quota_exceeded',
        errorCode: ERROR_CODES.FILE_QUOTA_EXCEEDED,
        status: HttpStatus.PAYLOAD_TOO_LARGE,
      });
    }

    if (usedBytes + incoming > this.env.filesUserQuotaBytes) {
      this.logger.warn(
        `quota — byte cap reached | userId: ${ownerUserId}, used: ${usedBytes}, incoming: ${incoming}`,
      );
      throw new TranslatableException({
        messageKey: 'error.file.quota_exceeded',
        errorCode: ERROR_CODES.FILE_QUOTA_EXCEEDED,
        status: HttpStatus.PAYLOAD_TOO_LARGE,
      });
    }
  }

  private toResponseDto(file: FileEntity, url: string): FileResponseDto {
    return plainToInstance(
      FileResponseDto,
      {
        id: file.id,
        owner_user_id: file.ownerUserId,
        mime_type: file.mimeType,
        size_bytes: Number(file.sizeBytes),
        original_name: file.originalName,
        purpose: file.purpose,
        url,
        created_at: file.createdAt.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }
}
