import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { IStorageProvider, STORAGE_PROVIDER } from '@common/modules/file-storage';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import {
  BusinessProfile,
  FileEntity,
  TaskComment,
  TaskCommentAttachment,
} from '@database/entities';
import { FilePurpose, TaskKanbanStatus } from '@database/enums';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { In } from 'typeorm';

import { CreateBoardCommentDto, UpdateBoardCommentDto } from '../../dto/requests';
import { BoardCommentResponseDto } from '../../dto/responses';
import { IBoardCommentsService } from '../../interfaces/board-comments.service.interface';
import { BusinessAccessService } from '../business-access.service';

interface ICommentRow {
  comment_id: string;
  task_id: string;
  author_id: string;
  comment: Record<string, unknown>;
  is_edited: boolean;
  edited_at: Date | null;
  created_at: Date;
  consultant_name: string | null;
  consultant_avatar: string | null;
  business_name: string | null;
  business_logo: string | null;
}

interface IAttachmentSeed {
  fileId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSizeBytes: string | null;
}

@Injectable()
export class BoardCommentsService implements IBoardCommentsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {
    this.logger = new AppLogger(BoardCommentsService.name, requestContext);
  }

  /** @inheritdoc */
  public async list(
    projectId: string,
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<BoardCommentResponseDto>> {
    this.logger.log(
      `list — start | projectId: ${projectId}, taskId: ${taskId}, page: ${pageOptions.page}, limit: ${pageOptions.limit}`,
    );
    await this.access.resolveOwnedProject(projectId);
    await this.assertTaskOnBoard(projectId, taskId);

    const baseQb = this.uow.taskComments
      .createQueryBuilder('tc')
      .where('tc.task_id = :taskId', { taskId })
      .andWhere('tc.is_deleted = false');

    const itemCount = await baseQb.clone().getCount();

    // Single SQL with both profile joins so consultant- and business-authored
    // comments resolve in one round-trip.
    const rows = await baseQb
      .leftJoin('consultant_profiles', 'cp', 'cp.user_id = tc.author_id')
      .leftJoin('business_profiles', 'bp', 'bp.user_id = tc.author_id')
      .select('tc.id', 'comment_id')
      .addSelect('tc.task_id', 'task_id')
      .addSelect('tc.author_id', 'author_id')
      .addSelect('tc.comment', 'comment')
      .addSelect('tc.is_edited', 'is_edited')
      .addSelect('tc.edited_at', 'edited_at')
      .addSelect('tc.created_at', 'created_at')
      .addSelect('cp.full_name', 'consultant_name')
      .addSelect('cp.avatar_url', 'consultant_avatar')
      .addSelect('bp.company_name', 'business_name')
      .addSelect('bp.logo_url', 'business_logo')
      .orderBy('tc.created_at', 'DESC')
      .addOrderBy('tc.id', 'DESC')
      .skip(pageOptions.skip)
      .take(pageOptions.limit)
      .getRawMany<ICommentRow>();

    if (rows.length === 0) {
      return new PageDto([], new PageMetaDto({ pageOptionsDto: pageOptions, itemCount }));
    }

    const commentIds = rows.map((r) => r.comment_id);
    const attachments = await this.uow.taskCommentAttachments.find({
      where: { commentId: In(commentIds) },
      order: { uploadedAt: 'ASC' },
    });

    const byComment = new Map<string, TaskCommentAttachment[]>();
    for (const a of attachments) {
      const list = byComment.get(a.commentId) ?? [];
      list.push(a);
      byComment.set(a.commentId, list);
    }

    const data = rows.map((r) => this.mapRow(r, byComment.get(r.comment_id) ?? []));
    this.logger.log(
      `list — complete | taskId: ${taskId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, new PageMetaDto({ pageOptionsDto: pageOptions, itemCount }));
  }

  /** @inheritdoc */
  public async create(
    projectId: string,
    taskId: string,
    dto: CreateBoardCommentDto,
  ): Promise<BoardCommentResponseDto> {
    this.logger.log(`create — start | projectId: ${projectId}, taskId: ${taskId}`);
    const { businessProfile } = await this.access.resolveOwnedProject(projectId);
    await this.assertTaskOnBoard(projectId, taskId);

    const userId = this.requestContext.userId!;
    // Resolve the storage URL outside the transaction — provider failures
    // shouldn't leave a long-lived locked tx hanging.
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
      `create — complete | commentId: ${saved.id}, attachments: ${attachments.length}`,
    );
    return this.toResponseDto(saved, attachments, businessProfile);
  }

  /** @inheritdoc */
  public async update(
    projectId: string,
    taskId: string,
    commentId: string,
    dto: UpdateBoardCommentDto,
  ): Promise<BoardCommentResponseDto> {
    this.logger.log(
      `update — start | projectId: ${projectId}, taskId: ${taskId}, commentId: ${commentId}`,
    );
    const { businessProfile } = await this.access.resolveOwnedProject(projectId);
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
      this.logger.warn(`update — non-author | commentId: ${commentId}, userId: ${userId}`);
      throw this.commentForbidden();
    }

    const seeds =
      dto.fileIds === undefined ? null : await this.resolveAttachmentSeeds(dto.fileIds, userId);

    // Capture the file_ids that will be detached so we can clear their
    // `purpose` after the new attachments are persisted.
    const detachedFileIds: string[] = [];
    if (seeds !== null) {
      const previous = await this.uow.taskCommentAttachments.find({
        where: { commentId },
        select: { fileId: true },
      });
      const keep = new Set(seeds.map((s) => s.fileId));
      for (const row of previous) {
        if (row.fileId && !keep.has(row.fileId)) {
          detachedFileIds.push(row.fileId);
        }
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
      `update — complete | commentId: ${saved.id}, attachments: ${attachments.length}, detached: ${detachedFileIds.length}`,
    );
    return this.toResponseDto(saved, attachments, businessProfile);
  }

  /** @inheritdoc */
  public async delete(projectId: string, taskId: string, commentId: string): Promise<void> {
    this.logger.log(
      `delete — start | projectId: ${projectId}, taskId: ${taskId}, commentId: ${commentId}`,
    );
    await this.access.resolveOwnedProject(projectId);
    await this.assertTaskOnBoard(projectId, taskId);

    const existing = await this.uow.taskComments.findOne({ where: { id: commentId, taskId } });
    if (!existing || existing.isDeleted) {
      throw this.commentNotFound(commentId);
    }

    const userId = this.requestContext.userId!;
    if (existing.authorId !== userId) {
      this.logger.warn(`delete — non-author | commentId: ${commentId}, userId: ${userId}`);
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
      // canonical files. The weekly orphan-cleanup cron reclaims the bytes
      // after the grace window — never delete bytes synchronously inside
      // a request.
      await tx.taskCommentAttachments.delete({ commentId });
      if (fileIds.length) {
        await tx.files.markAsOrphaned(fileIds);
      }
    });

    this.logger.log(`delete — complete | commentId: ${commentId}, files: ${fileIds.length}`);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Verifies the task exists, belongs to the project, and is on the board
   * (i.e. not DRAFT). Mirrors the predicate used by `BoardService.getTaskDetail`
   * so the comment endpoints stay consistent with the rest of the kanban surface.
   */
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
          `resolveAttachmentSeeds — file not owned | userId: ${userId}, fileId: ${id}`,
        );
        throw new TranslatableException({
          messageKey: 'error.task.comment_file_not_owned',
          errorCode: ERROR_CODES.TASK_COMMENT_FILE_NOT_OWNED,
          status: HttpStatus.BAD_REQUEST,
        });
      }
    }

    // Preserve client-supplied order when snapshotting.
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

  private mapRow(r: ICommentRow, attachments: TaskCommentAttachment[]): BoardCommentResponseDto {
    // Consultant identity wins when both profiles match — a user holding both
    // a consultant and business profile is acting as a consultant on the
    // assignee/comment side of the board.
    const name = r.consultant_name ?? r.business_name ?? '';
    const avatar = r.consultant_avatar ?? r.business_logo ?? null;
    return plainToInstance(
      BoardCommentResponseDto,
      {
        id: r.comment_id,
        task_id: r.task_id,
        author: {
          user_id: r.author_id,
          name,
          avatar_url: avatar,
        },
        comment: r.comment,
        is_edited: r.is_edited,
        edited_at: r.edited_at,
        created_at: r.created_at,
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
    businessProfile: BusinessProfile,
  ): BoardCommentResponseDto {
    return plainToInstance(
      BoardCommentResponseDto,
      {
        id: comment.id,
        task_id: comment.taskId,
        author: {
          user_id: businessProfile.userId,
          name: businessProfile.companyName,
          avatar_url: businessProfile.logoUrl,
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
    this.logger.warn(`comment operation — not found | commentId: ${commentId}`);
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
