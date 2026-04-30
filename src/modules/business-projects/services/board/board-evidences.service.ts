import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { TaskEvidenceAttachment } from '@database/entities';
import { TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { In } from 'typeorm';

import { BoardEvidenceResponseDto } from '../../dto/responses';
import { IBoardEvidencesService } from '../../interfaces/board-evidences.service.interface';
import { BusinessAccessService } from '../business-access.service';

interface IEvidenceRow {
  evidence_id: string;
  task_id: string;
  remarks: Record<string, unknown>;
  is_edited: boolean;
  edited_at: Date | null;
  created_at: Date;
  consultant_id: string | null;
  consultant_name: string | null;
  consultant_avatar: string | null;
}

@Injectable()
export class BoardEvidencesService implements IBoardEvidencesService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
  ) {
    this.logger = new AppLogger(BoardEvidencesService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async list(
    projectId: string,
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<BoardEvidenceResponseDto>> {
    this.logger.log(
      `[${this.rid}] list — start | projectId: ${projectId}, taskId: ${taskId}, page: ${pageOptions.page}, limit: ${pageOptions.limit}`,
    );
    await this.access.resolveOwnedProject(projectId);
    await this.assertTaskOnBoard(projectId, taskId);

    const baseQb = this.uow.taskEvidences
      .createQueryBuilder('te')
      .where('te.task_id = :taskId', { taskId })
      .andWhere('te.is_deleted = false');

    const itemCount = await baseQb.clone().getCount();

    const rows = await baseQb
      // The author is a User; we display them through their consultant_profile
      // (only consultants can author evidences per TaskEvidencesService).
      .leftJoin('consultant_profiles', 'cp', 'cp.user_id = te.author_id')
      .select('te.id', 'evidence_id')
      .addSelect('te.task_id', 'task_id')
      .addSelect('te.remarks', 'remarks')
      .addSelect('te.is_edited', 'is_edited')
      .addSelect('te.edited_at', 'edited_at')
      .addSelect('te.created_at', 'created_at')
      .addSelect('cp.id', 'consultant_id')
      .addSelect('cp.full_name', 'consultant_name')
      .addSelect('cp.avatar_url', 'consultant_avatar')
      .orderBy('te.created_at', 'DESC')
      .addOrderBy('te.id', 'DESC')
      .skip(pageOptions.skip)
      .take(pageOptions.limit)
      .getRawMany<IEvidenceRow>();

    if (rows.length === 0) {
      return new PageDto([], new PageMetaDto({ pageOptionsDto: pageOptions, itemCount }));
    }

    const evidenceIds = rows.map((r) => r.evidence_id);
    const attachments = await this.uow.taskEvidenceAttachments.find({
      where: { evidenceId: In(evidenceIds) },
      order: { uploadedAt: 'ASC' },
    });

    const byEvidence = new Map<string, TaskEvidenceAttachment[]>();
    for (const a of attachments) {
      const list = byEvidence.get(a.evidenceId) ?? [];
      list.push(a);
      byEvidence.set(a.evidenceId, list);
    }

    const data = rows.map((r) => this.mapRow(r, byEvidence.get(r.evidence_id) ?? []));
    this.logger.log(
      `[${this.rid}] list — complete | taskId: ${taskId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, new PageMetaDto({ pageOptionsDto: pageOptions, itemCount }));
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

  private mapRow(r: IEvidenceRow, attachments: TaskEvidenceAttachment[]): BoardEvidenceResponseDto {
    return plainToInstance(
      BoardEvidenceResponseDto,
      {
        id: r.evidence_id,
        task_id: r.task_id,
        author: {
          consultant_id: r.consultant_id ?? '',
          full_name: r.consultant_name ?? '',
          avatar_url: r.consultant_avatar,
        },
        remarks: r.remarks,
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
}
