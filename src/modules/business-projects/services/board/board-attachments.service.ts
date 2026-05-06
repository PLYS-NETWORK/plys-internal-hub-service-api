import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { IStorageProvider, STORAGE_PROVIDER } from '@common/modules/file-storage';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { FileEntity, TaskAttachment } from '@database/entities';
import { FilePurpose, TaskKanbanStatus } from '@database/enums';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { In } from 'typeorm';

import { AttachFilesDto, UpdateTaskAttachmentDto } from '../../dto/requests';
import { BoardTaskAttachmentResponseDto } from '../../dto/responses';
import { IBoardAttachmentsService } from '../../interfaces/board-attachments.service.interface';
import { BusinessAccessService } from '../business-access.service';
import { BoardCacheService } from './board-cache.service';

interface IAttachmentSeed {
  fileId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSizeBytes: string | null;
}

@Injectable()
export class BoardAttachmentsService implements IBoardAttachmentsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly cache: BoardCacheService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {
    this.logger = new AppLogger(BoardAttachmentsService.name, requestContext);
  }

  /** @inheritdoc */
  public async attach(
    projectId: string,
    taskId: string,
    dto: AttachFilesDto,
  ): Promise<BoardTaskAttachmentResponseDto[]> {
    this.logger.log(
      `attach — start | projectId: ${projectId}, taskId: ${taskId}, files: ${dto.fileIds.length}`,
    );
    await this.access.resolveOwnedProject(projectId);
    await this.assertTaskOnBoard(projectId, taskId);

    const userId = this.requestContext.userId!;
    const seeds = await this.resolveAttachmentSeeds(dto.fileIds, userId);

    const inserted = await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      const rows = seeds.map((s) =>
        tx.taskAttachments.create({
          taskId,
          fileId: s.fileId,
          fileName: s.fileName,
          fileUrl: s.fileUrl,
          mimeType: s.mimeType,
          fileSizeBytes: s.fileSizeBytes,
        }),
      );
      const saved = (await tx.taskAttachments.save(rows)) as TaskAttachment[];
      await tx.files.markAsAttached(
        seeds.map((s) => s.fileId),
        FilePurpose.TASK_ATTACHMENT,
      );
      return saved;
    });

    await this.cache.invalidateProject(projectId);

    this.logger.log(`attach — complete | taskId: ${taskId}, attached: ${inserted.length}`);
    return inserted.map((row) => this.toResponseDto(row));
  }

  /** @inheritdoc */
  public async update(
    projectId: string,
    taskId: string,
    attachmentId: string,
    dto: UpdateTaskAttachmentDto,
  ): Promise<BoardTaskAttachmentResponseDto> {
    this.logger.log(
      `update — start | projectId: ${projectId}, taskId: ${taskId}, attachmentId: ${attachmentId}`,
    );
    await this.access.resolveOwnedProject(projectId);
    await this.assertTaskOnBoard(projectId, taskId);

    const existing = await this.uow.taskAttachments.findOne({
      where: { id: attachmentId, taskId },
    });
    if (!existing) throw this.attachmentNotFound(attachmentId);

    existing.fileName = dto.fileName;
    const saved = (await this.uow.taskAttachments.save(existing)) as TaskAttachment;

    await this.cache.invalidateProject(projectId);

    this.logger.log(`update — complete | attachmentId: ${attachmentId}`);
    return this.toResponseDto(saved);
  }

  /** @inheritdoc */
  public async remove(projectId: string, taskId: string, attachmentId: string): Promise<void> {
    this.logger.log(
      `remove — start | projectId: ${projectId}, taskId: ${taskId}, attachmentId: ${attachmentId}`,
    );
    await this.access.resolveOwnedProject(projectId);
    await this.assertTaskOnBoard(projectId, taskId);

    const existing = await this.uow.taskAttachments.findOne({
      where: { id: attachmentId, taskId },
    });
    if (!existing) throw this.attachmentNotFound(attachmentId);

    const fileId = existing.fileId;

    await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      await tx.taskAttachments.softDelete({ id: attachmentId });
      if (fileId) await tx.files.markAsOrphaned([fileId]);
    });

    await this.cache.invalidateProject(projectId);

    this.logger.log(`remove — complete | attachmentId: ${attachmentId}, file: ${fileId ?? 'null'}`);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async assertTaskOnBoard(projectId: string, taskId: string): Promise<void> {
    const task = await this.uow.tasks.findOne({ where: { id: taskId, projectId } });
    if (!task || task.kanbanStatus === TaskKanbanStatus.DRAFT) {
      throw new TranslatableException({
        messageKey: 'error.task.not_found',
        errorCode: ERROR_CODES.TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
  }

  private async resolveAttachmentSeeds(
    fileIds: string[],
    userId: string,
  ): Promise<IAttachmentSeed[]> {
    const uniqueIds = Array.from(new Set(fileIds));
    const files = await this.uow.files.findBy({ id: In(uniqueIds) });
    const byId = new Map(files.map((f) => [f.id, f]));

    for (const id of uniqueIds) {
      const file = byId.get(id);
      if (!file || file.ownerUserId !== userId) {
        this.logger.warn(
          `resolveAttachmentSeeds — file not owned | userId: ${userId}, fileId: ${id}`,
        );
        throw new TranslatableException({
          messageKey: 'error.task.attachment_file_not_owned',
          errorCode: ERROR_CODES.TASK_ATTACHMENT_FILE_NOT_OWNED,
          status: HttpStatus.BAD_REQUEST,
        });
      }
    }

    return Promise.all(fileIds.map((id) => this.toSeed(byId.get(id) as FileEntity)));
  }

  private async toSeed(file: FileEntity): Promise<IAttachmentSeed> {
    const url = await this.storage.getUrl(file.storageKey);
    return {
      fileId: file.id,
      fileName: file.originalName,
      fileUrl: url,
      mimeType: file.mimeType,
      fileSizeBytes: file.sizeBytes === null ? null : String(file.sizeBytes),
    };
  }

  private toResponseDto(row: TaskAttachment): BoardTaskAttachmentResponseDto {
    return plainToInstance(
      BoardTaskAttachmentResponseDto,
      {
        id: row.id,
        file_id: row.fileId,
        file_name: row.fileName,
        file_url: row.fileUrl,
        mime_type: row.mimeType,
        file_size_bytes: row.fileSizeBytes === null ? null : Number(row.fileSizeBytes),
        uploaded_at: row.uploadedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  private attachmentNotFound(attachmentId: string): TranslatableException {
    this.logger.warn(`attachment operation — not found | attachmentId: ${attachmentId}`);
    return new TranslatableException({
      messageKey: 'error.task.attachment_not_found',
      errorCode: ERROR_CODES.TASK_ATTACHMENT_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }
}
