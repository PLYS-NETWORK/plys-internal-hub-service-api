import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { IStorageProvider, STORAGE_PROVIDER } from '@common/modules/file-storage';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { ConsultantProfile, FileEntity, TaskComment } from '@database/entities';
import { FilePurpose, TaskKanbanStatus } from '@database/enums';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { In } from 'typeorm';

import { CreateBoardCommentDto, UpdateBoardCommentDto } from '../../dto/requests';
import { ConsultantBoardCommentResponseDto } from '../../dto/responses';
import { IConsultantBoardCommentsService } from '../../interfaces/consultant-board-comments.service.interface';
import { ConsultantAccessService } from '../consultant-access.service';

interface IAttachmentSeed {
  fileId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSizeBytes: string | null;
}

@Injectable()
export class ConsultantBoardCommentsService implements IConsultantBoardCommentsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: ConsultantAccessService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {
    this.logger = new AppLogger(ConsultantBoardCommentsService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async create(
    projectId: string,
    taskId: string,
    dto: CreateBoardCommentDto,
  ): Promise<ConsultantBoardCommentResponseDto> {
    this.logger.log(
      `[${this.rid}] create — start | projectId: ${projectId}, taskId: ${taskId}, files: ${dto.fileIds?.length ?? 0}`,
    );
    const { consultantProfile } = await this.access.resolveProjectMembership(projectId);
    await this.assertTaskOnBoard(projectId, taskId);

    const userId = this.requestContext.userId!;
    const seeds = await this.resolveAttachmentSeeds(dto.fileIds ?? [], userId);

    const saved = await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      const comment = tx.taskComments.create({
        taskId,
        authorId: userId,
        comment: dto.comment,
      });
      const persisted = (await tx.taskComments.save(comment)) as TaskComment;
      if (seeds.length) {
        await this.insertAttachments(tx, persisted.id, seeds);
        await tx.files.markAsAttached(
          seeds.map((s) => s.fileId),
          FilePurpose.TASK_COMMENT,
        );
      }
      return persisted;
    });

    const attachments = await this.uow.taskCommentAttachments.find({
      where: { commentId: saved.id },
      order: { uploadedAt: 'ASC' },
    });

    this.logger.log(
      `[${this.rid}] create — complete | commentId: ${saved.id}, attachments: ${attachments.length}`,
    );
    return this.toResponseDto(saved, attachments, consultantProfile, userId);
  }

  /** @inheritdoc */
  public async update(
    projectId: string,
    taskId: string,
    commentId: string,
    dto: UpdateBoardCommentDto,
  ): Promise<ConsultantBoardCommentResponseDto> {
    this.logger.log(
      `[${this.rid}] update — start | projectId: ${projectId}, taskId: ${taskId}, commentId: ${commentId}`,
    );
    const { consultantProfile } = await this.access.resolveProjectMembership(projectId);
    await this.assertTaskOnBoard(projectId, taskId);

    if (dto.comment === undefined && dto.fileIds === undefined) {
      throw new TranslatableException({
        messageKey: 'error.task.comment_empty_update',
        errorCode: ERROR_CODES.TASK_COMMENT_EMPTY_UPDATE,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const existing = await this.uow.taskComments.findOne({ where: { id: commentId, taskId } });
    if (!existing || existing.isDeleted) {
      throw this.commentNotFound(commentId);
    }

    const userId = this.requestContext.userId!;
    if (existing.authorId !== userId) {
      this.logger.warn(
        `[${this.rid}] update — non-author | commentId: ${commentId}, userId: ${userId}`,
      );
      throw this.commentForbidden();
    }

    const seeds =
      dto.fileIds === undefined ? null : await this.resolveAttachmentSeeds(dto.fileIds, userId);

    // Capture file_ids about to be detached so we can clear their `purpose`
    // after the new attachments are persisted.
    const detachedFileIds: string[] = [];
    if (seeds !== null) {
      const previous = await this.uow.taskCommentAttachments.find({
        where: { commentId },
        select: { fileId: true },
      });
      const keep = new Set(seeds.map((s) => s.fileId));
      for (const row of previous) {
        if (row.fileId && !keep.has(row.fileId)) detachedFileIds.push(row.fileId);
      }
    }

    const saved = await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      if (dto.comment !== undefined) {
        existing.comment = dto.comment;
        existing.isEdited = true;
        existing.editedAt = DateUtil.nowDate();
      }
      const persisted = (await tx.taskComments.save(existing)) as TaskComment;

      if (seeds !== null) {
        await tx.taskCommentAttachments.delete({ commentId });
        if (seeds.length) {
          await this.insertAttachments(tx, commentId, seeds);
          await tx.files.markAsAttached(
            seeds.map((s) => s.fileId),
            FilePurpose.TASK_COMMENT,
          );
        }
        if (detachedFileIds.length) {
          await tx.files.markAsOrphaned(detachedFileIds);
        }
      }

      return persisted;
    });

    const attachments = await this.uow.taskCommentAttachments.find({
      where: { commentId: saved.id },
      order: { uploadedAt: 'ASC' },
    });

    this.logger.log(
      `[${this.rid}] update — complete | commentId: ${saved.id}, attachments: ${attachments.length}, detached: ${detachedFileIds.length}`,
    );
    return this.toResponseDto(saved, attachments, consultantProfile, userId);
  }

  /** @inheritdoc */
  public async delete(projectId: string, taskId: string, commentId: string): Promise<void> {
    this.logger.log(
      `[${this.rid}] delete — start | projectId: ${projectId}, taskId: ${taskId}, commentId: ${commentId}`,
    );
    await this.access.resolveProjectMembership(projectId);
    await this.assertTaskOnBoard(projectId, taskId);

    const existing = await this.uow.taskComments.findOne({ where: { id: commentId, taskId } });
    if (!existing || existing.isDeleted) throw this.commentNotFound(commentId);

    const userId = this.requestContext.userId!;
    if (existing.authorId !== userId) {
      this.logger.warn(
        `[${this.rid}] delete — non-author | commentId: ${commentId}, userId: ${userId}`,
      );
      throw this.commentForbidden();
    }

    const attachmentRows = await this.uow.taskCommentAttachments.find({
      where: { commentId },
      select: { fileId: true },
    });
    const fileIds = attachmentRows.map((a) => a.fileId).filter((id): id is string => id !== null);

    await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      existing.isDeleted = true;
      await tx.taskComments.save(existing);
      // Hard-delete the cheap snapshot rows and clear `purpose` on the
      // canonical files; the orphan-cleanup cron reclaims bytes after the
      // grace window — never delete bytes synchronously inside a request.
      await tx.taskCommentAttachments.delete({ commentId });
      if (fileIds.length) {
        await tx.files.markAsOrphaned(fileIds);
      }
    });

    this.logger.log(
      `[${this.rid}] delete — complete | commentId: ${commentId}, files: ${fileIds.length}`,
    );
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
    if (fileIds.length === 0) return [];
    const uniqueIds = Array.from(new Set(fileIds));
    const files = await this.uow.files.findBy({ id: In(uniqueIds) });
    const byId = new Map(files.map((f) => [f.id, f]));

    for (const id of uniqueIds) {
      const file = byId.get(id);
      if (!file || file.ownerUserId !== userId) {
        this.logger.warn(
          `[${this.rid}] resolveAttachmentSeeds — file not owned | userId: ${userId}, fileId: ${id}`,
        );
        throw new TranslatableException({
          messageKey: 'error.task.comment_file_not_owned',
          errorCode: ERROR_CODES.TASK_COMMENT_FILE_NOT_OWNED,
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
    commentId: string,
    seeds: IAttachmentSeed[],
  ): Promise<void> {
    const rows = seeds.map((s) =>
      tx.taskCommentAttachments.create({
        commentId,
        fileId: s.fileId,
        fileName: s.fileName,
        fileUrl: s.fileUrl,
        mimeType: s.mimeType,
        fileSizeBytes: s.fileSizeBytes,
      }),
    );
    await tx.taskCommentAttachments.save(rows);
  }

  private toResponseDto(
    comment: TaskComment,
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
  ): ConsultantBoardCommentResponseDto {
    return plainToInstance(
      ConsultantBoardCommentResponseDto,
      {
        id: comment.id,
        task_id: comment.taskId,
        author: {
          user_id: userId,
          consultant_id: consultantProfile.id,
          full_name: consultantProfile.fullName,
          avatar_url: consultantProfile.avatarUrl ?? null,
        },
        comment: comment.comment,
        is_edited: comment.isEdited,
        edited_at: comment.editedAt,
        created_at: comment.createdAt,
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

  private commentNotFound(commentId: string): TranslatableException {
    this.logger.warn(`[${this.rid}] comment operation — not found | commentId: ${commentId}`);
    return new TranslatableException({
      messageKey: 'error.task.comment_not_found',
      errorCode: ERROR_CODES.TASK_COMMENT_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }

  private commentForbidden(): TranslatableException {
    return new TranslatableException({
      messageKey: 'error.task.comment_forbidden',
      errorCode: ERROR_CODES.TASK_COMMENT_FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
    });
  }
}
