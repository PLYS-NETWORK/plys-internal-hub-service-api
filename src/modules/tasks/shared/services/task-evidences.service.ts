import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { IStorageProvider, STORAGE_PROVIDER } from '@common/modules/file-storage';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { FileEntity, TaskEvidence, TaskEvidenceAttachment } from '@database/entities';
import { FilePurpose, ProjectMemberStatus } from '@database/enums';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';

import { CreateTaskEvidenceDto, UpdateTaskEvidenceDto } from '../../dto/requests';
import { TaskEvidenceResponseDto } from '../../dto/responses';
import { TASK_ERRORS } from '../constants/task-error-messages.constant';
import { ITaskEvidencesService } from '../interfaces/task-evidences.service.interface';
import { TaskAccessService } from './task-access.service';
import { TaskMapperService } from './task-mapper.service';

@Injectable()
export class TaskEvidencesService implements ITaskEvidencesService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly taskAccess: TaskAccessService,
    private readonly taskMapper: TaskMapperService,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {
    this.logger = new AppLogger(TaskEvidencesService.name, requestContext);
  }

  /** @inheritdoc */
  public async createEvidence(
    taskId: string,
    dto: CreateTaskEvidenceDto,
  ): Promise<TaskEvidenceResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`createEvidence — start | taskId: ${taskId}`);

    const task = await this.uow.tasks.findOne({ where: { id: taskId } });
    if (!task) {
      throw this.taskAccess.taskNotFound(taskId);
    }

    const consultantProfile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!consultantProfile || task.assignedTo !== consultantProfile.id) {
      this.logger.warn(`createEvidence — not assignee | taskId: ${taskId}, userId: ${userId}`);
      throw this.notAssignee();
    }

    // Resolve attachment metadata BEFORE opening the transaction so storage URL
    // resolution failures don't leak open transactions.
    const attachmentSeeds = await this.resolveAttachmentSeeds(dto.fileIds ?? [], userId);

    const saved = await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      const evidence = tx.taskEvidences.create({
        taskId,
        authorId: userId,
        remarks: dto.remarks,
      });
      const persisted = (await tx.taskEvidences.save(evidence)) as TaskEvidence;

      if (attachmentSeeds.length) {
        await this.insertAttachments(tx, persisted.id, attachmentSeeds);
        await tx.files.markAsAttached(
          attachmentSeeds.map((s) => s.fileId),
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
      `createEvidence — complete | evidenceId: ${saved.id}, attachments: ${attachments.length}`,
    );
    return this.taskMapper.toTaskEvidenceResponseDto(saved, attachments);
  }

  /** @inheritdoc */
  public async listEvidences(taskId: string): Promise<TaskEvidenceResponseDto[]> {
    this.logger.log(`listEvidences — start | taskId: ${taskId}`);

    const task = await this.uow.tasks.findOne({
      where: { id: taskId },
      relations: { project: true },
    });
    if (!task) {
      throw this.taskAccess.taskNotFound(taskId);
    }

    await this.verifyReadAccess(task.project.businessId, task.projectId);

    const evidences = await this.uow.taskEvidences.find({
      where: { taskId, isDeleted: false },
      order: { createdAt: 'ASC' },
    });

    if (evidences.length === 0) {
      this.logger.log(`listEvidences — complete | taskId: ${taskId}, returned: 0`);
      return [];
    }

    const evidenceIds = evidences.map((e) => e.id);
    const attachments = await this.uow.taskEvidenceAttachments.find({
      where: { evidenceId: In(evidenceIds) },
      order: { uploadedAt: 'ASC' },
    });

    const byEvidence = new Map<string, TaskEvidenceAttachment[]>();
    for (const att of attachments) {
      const list = byEvidence.get(att.evidenceId) ?? [];
      list.push(att);
      byEvidence.set(att.evidenceId, list);
    }

    this.logger.log(`listEvidences — complete | taskId: ${taskId}, returned: ${evidences.length}`);
    return evidences.map((e) =>
      this.taskMapper.toTaskEvidenceResponseDto(e, byEvidence.get(e.id) ?? []),
    );
  }

  /** @inheritdoc */
  public async updateEvidence(
    evidenceId: string,
    dto: UpdateTaskEvidenceDto,
  ): Promise<TaskEvidenceResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`updateEvidence — start | evidenceId: ${evidenceId}`);

    if (dto.remarks === undefined && dto.fileIds === undefined) {
      throw new TranslatableException({
        messageKey: TASK_ERRORS.EVIDENCE_EMPTY_UPDATE,
        errorCode: ERROR_CODES.TASK_EVIDENCE_EMPTY_UPDATE,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    const evidence = await this.uow.taskEvidences.findOne({ where: { id: evidenceId } });
    if (!evidence || evidence.isDeleted) {
      throw this.evidenceNotFound(evidenceId);
    }

    if (evidence.authorId !== userId) {
      throw this.evidenceForbidden();
    }

    const attachmentSeeds =
      dto.fileIds === undefined ? null : await this.resolveAttachmentSeeds(dto.fileIds, userId);

    // Capture detached file_ids so we can clear their `purpose` and let the
    // weekly orphan-cleanup cron reclaim them after the grace window.
    const detachedFileIds: string[] = [];
    if (attachmentSeeds !== null) {
      const previous = await this.uow.taskEvidenceAttachments.find({
        where: { evidenceId },
        select: { fileId: true },
      });
      const keep = new Set(attachmentSeeds.map((s) => s.fileId));
      for (const row of previous) {
        if (row.fileId && !keep.has(row.fileId)) {
          detachedFileIds.push(row.fileId);
        }
      }
    }

    const saved = await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      if (dto.remarks !== undefined) {
        evidence.remarks = dto.remarks;
        evidence.isEdited = true;
        evidence.editedAt = new Date();
      }
      const persisted = (await tx.taskEvidences.save(evidence)) as TaskEvidence;

      if (attachmentSeeds !== null) {
        await tx.taskEvidenceAttachments.delete({ evidenceId });
        if (attachmentSeeds.length) {
          await this.insertAttachments(tx, evidenceId, attachmentSeeds);
          await tx.files.markAsAttached(
            attachmentSeeds.map((s) => s.fileId),
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
      `updateEvidence — complete | evidenceId: ${saved.id}, attachments: ${attachments.length}, detached: ${detachedFileIds.length}`,
    );
    return this.taskMapper.toTaskEvidenceResponseDto(saved, attachments);
  }

  /** @inheritdoc */
  public async deleteEvidence(evidenceId: string): Promise<void> {
    const userId = this.requestContext.userId!;
    this.logger.log(`deleteEvidence — start | evidenceId: ${evidenceId}`);

    const evidence = await this.uow.taskEvidences.findOne({ where: { id: evidenceId } });
    if (!evidence || evidence.isDeleted) {
      throw this.evidenceNotFound(evidenceId);
    }

    if (evidence.authorId !== userId) {
      throw this.evidenceForbidden();
    }

    const attachmentRows = await this.uow.taskEvidenceAttachments.find({
      where: { evidenceId },
      select: { fileId: true },
    });
    const fileIds = attachmentRows.map((a) => a.fileId).filter((id): id is string => id !== null);

    await this.uow.withTransaction(async (tx: IUnitOfWork) => {
      evidence.isDeleted = true;
      await tx.taskEvidences.save(evidence);
      // Hard-delete the snapshot rows so the LEFT-JOIN safety net in the
      // orphan-cleanup cron is consistent with `purpose IS NULL`. Listing
      // already filters `isDeleted = false`, so the rows have no readers.
      await tx.taskEvidenceAttachments.delete({ evidenceId });
      if (fileIds.length) {
        await tx.files.markAsOrphaned(fileIds);
      }
    });

    this.logger.log(
      `deleteEvidence — complete | evidenceId: ${evidenceId}, files: ${fileIds.length}`,
    );
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Verifies the caller is either the project-owning business or an ACTIVE
   * consultant member of the project. Mirrors the predicate used for comments.
   */
  private async verifyReadAccess(businessId: string, projectId: string): Promise<void> {
    const userId = this.requestContext.userId!;

    const businessProfile = await this.uow.businessProfiles.findByUserId(userId);
    if (businessProfile && businessProfile.id === businessId) {
      return;
    }

    const consultantProfile = await this.uow.consultantProfiles.findByUserId(userId);
    if (consultantProfile) {
      const member = await this.uow.projectMembers.findOne({
        where: {
          projectId,
          consultantId: consultantProfile.id,
          status: ProjectMemberStatus.ACTIVE,
        },
      });
      if (member) return;
    }

    this.logger.warn(`verifyReadAccess — denied | userId: ${userId}, projectId: ${projectId}`);
    throw this.evidenceForbidden();
  }

  /**
   * Validates that every supplied file ID belongs to the caller and resolves a
   * fresh URL from the storage provider. The returned seeds carry the snapshot
   * fields persisted into `task_evidence_attachments` so the row stays
   * meaningful even after the source `files` row is removed.
   */
  private async resolveAttachmentSeeds(
    fileIds: string[],
    userId: string,
  ): Promise<IAttachmentSeed[]> {
    if (fileIds.length === 0) return [];

    // De-duplicate to avoid validating the same file twice when the client
    // accidentally repeats an ID.
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
          messageKey: TASK_ERRORS.EVIDENCE_FILE_NOT_OWNED,
          errorCode: ERROR_CODES.TASK_EVIDENCE_FILE_NOT_OWNED,
          status: HttpStatus.BAD_REQUEST,
        });
      }
    }

    // Preserve the order the client sent in.
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

  private notAssignee(): TranslatableException {
    return new TranslatableException({
      messageKey: TASK_ERRORS.EVIDENCE_NOT_ASSIGNEE,
      errorCode: ERROR_CODES.TASK_EVIDENCE_NOT_ASSIGNEE,
      status: HttpStatus.FORBIDDEN,
    });
  }

  private evidenceNotFound(evidenceId: string): TranslatableException {
    this.logger.warn(`evidence operation — evidence not found | evidenceId: ${evidenceId}`);
    return new TranslatableException({
      messageKey: TASK_ERRORS.EVIDENCE_NOT_FOUND,
      errorCode: ERROR_CODES.TASK_EVIDENCE_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  }

  private evidenceForbidden(): TranslatableException {
    return new TranslatableException({
      messageKey: TASK_ERRORS.EVIDENCE_FORBIDDEN,
      errorCode: ERROR_CODES.TASK_EVIDENCE_FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
    });
  }
}

interface IAttachmentSeed {
  fileId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSizeBytes: string | null;
}
