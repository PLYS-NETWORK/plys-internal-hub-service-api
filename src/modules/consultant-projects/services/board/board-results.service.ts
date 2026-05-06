import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { IStorageProvider, STORAGE_PROVIDER } from '@common/modules/file-storage';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { ConsultantProfile, FileEntity, TaskResult } from '@database/entities';
import { FilePurpose, TaskKanbanStatus } from '@database/enums';
import { BoardCacheService } from '@modules/business-projects/services/board/board-cache.service';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { In } from 'typeorm';

import { CreateBoardResultDto, UpdateBoardResultDto } from '../../dto/requests';
import { ConsultantBoardResultResponseDto } from '../../dto/responses';
import { IConsultantBoardResultsService } from '../../interfaces/consultant-board-results.service.interface';
import { ConsultantAccessService } from '../consultant-access.service';

interface IAttachmentSeed {
  fileId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSizeBytes: string | null;
}

@Injectable()
export class ConsultantBoardResultsService implements IConsultantBoardResultsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: ConsultantAccessService,
    private readonly cache: BoardCacheService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {
    this.logger = new AppLogger(ConsultantBoardResultsService.name, requestContext);
  }

  /** @inheritdoc */
  public async create(
    projectId: string,
    taskId: string,
    dto: CreateBoardResultDto,
  ): Promise<ConsultantBoardResultResponseDto> {
    this.logger.log(
      `create — start | projectId: ${projectId}, taskId: ${taskId}, files: ${dto.fileIds?.length ?? 0}`,
    );
    const { consultantProfile } = await this.access.resolveProjectMembership(projectId);
    await this.assertAssigneeOnBoard(projectId, taskId, consultantProfile.id);

    const userId = this.requestContext.userId!;
    const seeds = await this.resolveAttachmentSeeds(dto.fileIds ?? [], userId);

    const saved = await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      const result = tx.taskResults.create({
        taskId,
        authorId: userId,
        remarks: dto.remarks,
      });
      const persisted = (await tx.taskResults.save(result)) as TaskResult;
      if (seeds.length) {
        await this.insertAttachments(tx, persisted.id, seeds);
        await tx.files.markAsAttached(
          seeds.map((s) => s.fileId),
          FilePurpose.TASK_RESULT,
        );
      }
      return persisted;
    });

    const attachments = await this.uow.taskResultAttachments.find({
      where: { resultId: saved.id },
      order: { uploadedAt: 'ASC' },
    });

    await this.cache.invalidateProject(projectId);

    this.logger.log(
      `create — complete | resultId: ${saved.id}, attachments: ${attachments.length}`,
    );
    return this.toResponseDto(saved, attachments, consultantProfile, userId);
  }

  /** @inheritdoc */
  public async update(
    projectId: string,
    taskId: string,
    resultId: string,
    dto: UpdateBoardResultDto,
  ): Promise<ConsultantBoardResultResponseDto> {
    this.logger.log(
      `update — start | projectId: ${projectId}, taskId: ${taskId}, resultId: ${resultId}`,
    );
    const { consultantProfile } = await this.access.resolveProjectMembership(projectId);
    await this.assertAssigneeOnBoard(projectId, taskId, consultantProfile.id);

    if (dto.remarks === undefined && dto.fileIds === undefined) {
      throw new TranslatableException({
        messageKey: 'error.task.result_empty_update',
        errorCode: ERROR_CODES.TASK_RESULT_EMPTY_UPDATE,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const existing = await this.uow.taskResults.findOne({
      where: { id: resultId, taskId },
    });
    if (!existing || existing.isDeleted) throw this.resultNotFound(resultId);

    const userId = this.requestContext.userId!;
    if (existing.authorId !== userId) {
      this.logger.warn(`update — non-author | resultId: ${resultId}, userId: ${userId}`);
      throw this.resultForbidden();
    }

    const seeds =
      dto.fileIds === undefined ? null : await this.resolveAttachmentSeeds(dto.fileIds, userId);

    const detachedFileIds: string[] = [];
    if (seeds !== null) {
      const previous = await this.uow.taskResultAttachments.find({
        where: { resultId },
        select: { fileId: true },
      });
      const keep = new Set(seeds.map((s) => s.fileId));
      for (const row of previous) {
        if (row.fileId && !keep.has(row.fileId)) detachedFileIds.push(row.fileId);
      }
    }

    const saved = await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      if (dto.remarks !== undefined) {
        existing.remarks = dto.remarks;
        existing.isEdited = true;
        existing.editedAt = DateUtil.nowDate();
      }
      const persisted = (await tx.taskResults.save(existing)) as TaskResult;

      if (seeds !== null) {
        await tx.taskResultAttachments.delete({ resultId });
        if (seeds.length) {
          await this.insertAttachments(tx, resultId, seeds);
          await tx.files.markAsAttached(
            seeds.map((s) => s.fileId),
            FilePurpose.TASK_RESULT,
          );
        }
        if (detachedFileIds.length) {
          await tx.files.markAsOrphaned(detachedFileIds);
        }
      }

      return persisted;
    });

    const attachments = await this.uow.taskResultAttachments.find({
      where: { resultId: saved.id },
      order: { uploadedAt: 'ASC' },
    });

    await this.cache.invalidateProject(projectId);

    this.logger.log(
      `update — complete | resultId: ${saved.id}, attachments: ${attachments.length}, detached: ${detachedFileIds.length}`,
    );
    return this.toResponseDto(saved, attachments, consultantProfile, userId);
  }

  /** @inheritdoc */
  public async delete(projectId: string, taskId: string, resultId: string): Promise<void> {
    this.logger.log(
      `delete — start | projectId: ${projectId}, taskId: ${taskId}, resultId: ${resultId}`,
    );
    const { consultantProfile } = await this.access.resolveProjectMembership(projectId);
    await this.assertAssigneeOnBoard(projectId, taskId, consultantProfile.id);

    const existing = await this.uow.taskResults.findOne({
      where: { id: resultId, taskId },
    });
    if (!existing || existing.isDeleted) throw this.resultNotFound(resultId);

    const userId = this.requestContext.userId!;
    if (existing.authorId !== userId) {
      this.logger.warn(`delete — non-author | resultId: ${resultId}, userId: ${userId}`);
      throw this.resultForbidden();
    }

    const attachmentRows = await this.uow.taskResultAttachments.find({
      where: { resultId },
      select: { fileId: true },
    });
    const fileIds = attachmentRows.map((a) => a.fileId).filter((id): id is string => id !== null);

    await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      existing.isDeleted = true;
      await tx.taskResults.save(existing);
      await tx.taskResultAttachments.delete({ resultId });
      if (fileIds.length) {
        await tx.files.markAsOrphaned(fileIds);
      }
    });

    await this.cache.invalidateProject(projectId);

    this.logger.log(`delete — complete | resultId: ${resultId}, files: ${fileIds.length}`);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  // Result authoring is restricted to the task's current assignee. The check
  // covers both the task-on-board predicate and the assignee predicate so all
  // entry points share one error contract.
  private async assertAssigneeOnBoard(
    projectId: string,
    taskId: string,
    consultantId: string,
  ): Promise<void> {
    const task = await this.uow.tasks.findOne({ where: { id: taskId, projectId } });
    if (!task || task.kanbanStatus === TaskKanbanStatus.DRAFT) {
      throw new TranslatableException({
        messageKey: 'error.task.not_found',
        errorCode: ERROR_CODES.TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    if (task.assignedTo !== consultantId) {
      throw new TranslatableException({
        messageKey: 'error.task.result_not_assignee',
        errorCode: ERROR_CODES.TASK_RESULT_NOT_ASSIGNEE,
        status: HttpStatus.FORBIDDEN,
      });
    }
  }

  private async resolveAttachmentSeeds(
    fileIds: string[],
    userId: string,
  ): Promise<IAttachmentSeed[]> {
    if (fileIds.length === 0) return [];
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
          messageKey: 'error.task.result_file_not_owned',
          errorCode: ERROR_CODES.TASK_RESULT_FILE_NOT_OWNED,
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

  private async insertAttachments(
    tx: IUnitOfWork,
    resultId: string,
    seeds: IAttachmentSeed[],
  ): Promise<void> {
    const rows = seeds.map((s) =>
      tx.taskResultAttachments.create({
        resultId,
        fileId: s.fileId,
        fileName: s.fileName,
        fileUrl: s.fileUrl,
        mimeType: s.mimeType,
        fileSizeBytes: s.fileSizeBytes,
      }),
    );
    await tx.taskResultAttachments.save(rows);
  }

  private toResponseDto(
    result: TaskResult,
    attachments: {
      id: string;
      fileId: string | null;
      fileName: string;
      fileUrl: string;
      mimeType: string | null;
      fileSizeBytes: string | null;
      uploadedAt: Date;
    }[],
    consultantProfile: ConsultantProfile,
    userId: string,
  ): ConsultantBoardResultResponseDto {
    return plainToInstance(
      ConsultantBoardResultResponseDto,
      {
        id: result.id,
        task_id: result.taskId,
        author: {
          user_id: userId,
          consultant_id: consultantProfile.id,
          full_name: consultantProfile.fullName,
          avatar_url: consultantProfile.avatarUrl ?? null,
        },
        remarks: result.remarks,
        is_edited: result.isEdited,
        edited_at: result.editedAt,
        created_at: result.createdAt,
        attachments: attachments.map((a) => ({
          id: a.id,
          file_id: a.fileId,
          file_name: a.fileName,
          file_url: a.fileUrl,
          mime_type: a.mimeType,
          file_size_bytes: a.fileSizeBytes === null ? null : Number(a.fileSizeBytes),
          uploaded_at: a.uploadedAt,
        })),
      },
      { excludeExtraneousValues: true },
    );
  }

  private resultNotFound(resultId: string): TranslatableException {
    this.logger.warn(`result operation — not found | resultId: ${resultId}`);
    return new TranslatableException({
      messageKey: 'error.task.result_not_found',
      errorCode: ERROR_CODES.TASK_RESULT_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }

  private resultForbidden(): TranslatableException {
    return new TranslatableException({
      messageKey: 'error.task.result_forbidden',
      errorCode: ERROR_CODES.TASK_RESULT_FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
    });
  }
}
