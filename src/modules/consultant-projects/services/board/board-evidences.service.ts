import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { IStorageProvider, STORAGE_PROVIDER } from '@common/modules/file-storage';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { ConsultantProfile, FileEntity, TaskEvidence } from '@database/entities';
import { FilePurpose, TaskKanbanStatus } from '@database/enums';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { In } from 'typeorm';

import { CreateBoardEvidenceDto, UpdateBoardEvidenceDto } from '../../dto/requests';
import { ConsultantBoardEvidenceResponseDto } from '../../dto/responses';
import { IConsultantBoardEvidencesService } from '../../interfaces/consultant-board-evidences.service.interface';
import { ConsultantAccessService } from '../consultant-access.service';

interface IAttachmentSeed {
  fileId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSizeBytes: string | null;
}

@Injectable()
export class ConsultantBoardEvidencesService implements IConsultantBoardEvidencesService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: ConsultantAccessService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {
    this.logger = new AppLogger(ConsultantBoardEvidencesService.name, requestContext);
  }

  /** @inheritdoc */
  public async create(
    projectId: string,
    taskId: string,
    dto: CreateBoardEvidenceDto,
  ): Promise<ConsultantBoardEvidenceResponseDto> {
    this.logger.log(
      `create — start | projectId: ${projectId}, taskId: ${taskId}, files: ${dto.fileIds?.length ?? 0}`,
    );
    const { consultantProfile } = await this.access.resolveProjectMembership(projectId);
    await this.assertAssigneeOnBoard(projectId, taskId, consultantProfile.id);

    const userId = this.requestContext.userId!;
    const seeds = await this.resolveAttachmentSeeds(dto.fileIds ?? [], userId);

    const saved = await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      const evidence = tx.taskEvidences.create({
        taskId,
        authorId: userId,
        remarks: dto.remarks,
      });
      const persisted = (await tx.taskEvidences.save(evidence)) as TaskEvidence;
      if (seeds.length) {
        await this.insertAttachments(tx, persisted.id, seeds);
        await tx.files.markAsAttached(
          seeds.map((s) => s.fileId),
          FilePurpose.TASK_EVIDENCE,
        );
      }
      return persisted;
    });

    const attachments = await this.uow.taskEvidenceAttachments.find({
      where: { evidenceId: saved.id },
      order: { uploadedAt: 'ASC' },
    });

    this.logger.log(
      `create — complete | evidenceId: ${saved.id}, attachments: ${attachments.length}`,
    );
    return this.toResponseDto(saved, attachments, consultantProfile, userId);
  }

  /** @inheritdoc */
  public async update(
    projectId: string,
    taskId: string,
    evidenceId: string,
    dto: UpdateBoardEvidenceDto,
  ): Promise<ConsultantBoardEvidenceResponseDto> {
    this.logger.log(
      `update — start | projectId: ${projectId}, taskId: ${taskId}, evidenceId: ${evidenceId}`,
    );
    const { consultantProfile } = await this.access.resolveProjectMembership(projectId);
    await this.assertAssigneeOnBoard(projectId, taskId, consultantProfile.id);

    if (dto.remarks === undefined && dto.fileIds === undefined) {
      throw new TranslatableException({
        messageKey: 'error.task.evidence_empty_update',
        errorCode: ERROR_CODES.TASK_EVIDENCE_EMPTY_UPDATE,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const existing = await this.uow.taskEvidences.findOne({
      where: { id: evidenceId, taskId },
    });
    if (!existing || existing.isDeleted) throw this.evidenceNotFound(evidenceId);

    const userId = this.requestContext.userId!;
    if (existing.authorId !== userId) {
      this.logger.warn(`update — non-author | evidenceId: ${evidenceId}, userId: ${userId}`);
      throw this.evidenceForbidden();
    }

    const seeds =
      dto.fileIds === undefined ? null : await this.resolveAttachmentSeeds(dto.fileIds, userId);

    const detachedFileIds: string[] = [];
    if (seeds !== null) {
      const previous = await this.uow.taskEvidenceAttachments.find({
        where: { evidenceId },
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
      const persisted = (await tx.taskEvidences.save(existing)) as TaskEvidence;

      if (seeds !== null) {
        await tx.taskEvidenceAttachments.delete({ evidenceId });
        if (seeds.length) {
          await this.insertAttachments(tx, evidenceId, seeds);
          await tx.files.markAsAttached(
            seeds.map((s) => s.fileId),
            FilePurpose.TASK_EVIDENCE,
          );
        }
        if (detachedFileIds.length) {
          await tx.files.markAsOrphaned(detachedFileIds);
        }
      }

      return persisted;
    });

    const attachments = await this.uow.taskEvidenceAttachments.find({
      where: { evidenceId: saved.id },
      order: { uploadedAt: 'ASC' },
    });

    this.logger.log(
      `update — complete | evidenceId: ${saved.id}, attachments: ${attachments.length}, detached: ${detachedFileIds.length}`,
    );
    return this.toResponseDto(saved, attachments, consultantProfile, userId);
  }

  /** @inheritdoc */
  public async delete(projectId: string, taskId: string, evidenceId: string): Promise<void> {
    this.logger.log(
      `delete — start | projectId: ${projectId}, taskId: ${taskId}, evidenceId: ${evidenceId}`,
    );
    const { consultantProfile } = await this.access.resolveProjectMembership(projectId);
    await this.assertAssigneeOnBoard(projectId, taskId, consultantProfile.id);

    const existing = await this.uow.taskEvidences.findOne({
      where: { id: evidenceId, taskId },
    });
    if (!existing || existing.isDeleted) throw this.evidenceNotFound(evidenceId);

    const userId = this.requestContext.userId!;
    if (existing.authorId !== userId) {
      this.logger.warn(`delete — non-author | evidenceId: ${evidenceId}, userId: ${userId}`);
      throw this.evidenceForbidden();
    }

    const attachmentRows = await this.uow.taskEvidenceAttachments.find({
      where: { evidenceId },
      select: { fileId: true },
    });
    const fileIds = attachmentRows.map((a) => a.fileId).filter((id): id is string => id !== null);

    await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      existing.isDeleted = true;
      await tx.taskEvidences.save(existing);
      await tx.taskEvidenceAttachments.delete({ evidenceId });
      if (fileIds.length) {
        await tx.files.markAsOrphaned(fileIds);
      }
    });

    this.logger.log(`delete — complete | evidenceId: ${evidenceId}, files: ${fileIds.length}`);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  // Evidence is restricted to the task's current assignee. The check covers
  // both the task-on-board predicate and the assignee predicate so all entry
  // points share one error contract.
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
        messageKey: 'error.task.evidence_not_assignee',
        errorCode: ERROR_CODES.TASK_EVIDENCE_NOT_ASSIGNEE,
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
          messageKey: 'error.task.evidence_file_not_owned',
          errorCode: ERROR_CODES.TASK_EVIDENCE_FILE_NOT_OWNED,
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
    evidenceId: string,
    seeds: IAttachmentSeed[],
  ): Promise<void> {
    const rows = seeds.map((s) =>
      tx.taskEvidenceAttachments.create({
        evidenceId,
        fileId: s.fileId,
        fileName: s.fileName,
        fileUrl: s.fileUrl,
        mimeType: s.mimeType,
        fileSizeBytes: s.fileSizeBytes,
      }),
    );
    await tx.taskEvidenceAttachments.save(rows);
  }

  private toResponseDto(
    evidence: TaskEvidence,
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
  ): ConsultantBoardEvidenceResponseDto {
    return plainToInstance(
      ConsultantBoardEvidenceResponseDto,
      {
        id: evidence.id,
        task_id: evidence.taskId,
        author: {
          user_id: userId,
          consultant_id: consultantProfile.id,
          full_name: consultantProfile.fullName,
          avatar_url: consultantProfile.avatarUrl ?? null,
        },
        remarks: evidence.remarks,
        is_edited: evidence.isEdited,
        edited_at: evidence.editedAt,
        created_at: evidence.createdAt,
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

  private evidenceNotFound(evidenceId: string): TranslatableException {
    this.logger.warn(`evidence operation — not found | evidenceId: ${evidenceId}`);
    return new TranslatableException({
      messageKey: 'error.task.evidence_not_found',
      errorCode: ERROR_CODES.TASK_EVIDENCE_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }

  private evidenceForbidden(): TranslatableException {
    return new TranslatableException({
      messageKey: 'error.task.evidence_forbidden',
      errorCode: ERROR_CODES.TASK_EVIDENCE_FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
    });
  }
}
