import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { TaskHistoryChangeType, TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { BoardTaskHistoryResponseDto } from '../../dto/responses';
import { IBoardHistoryService } from '../../interfaces/board-history.service.interface';
import { BusinessAccessService } from '../business-access.service';

interface IHistoryRow {
  history_id: string;
  task_id: string;
  change_type: TaskHistoryChangeType;
  prev_status: TaskKanbanStatus | null;
  new_status: TaskKanbanStatus | null;
  prev_consultant_id: string | null;
  prev_full_name: string | null;
  prev_avatar_url: string | null;
  new_consultant_id: string | null;
  new_full_name: string | null;
  new_avatar_url: string | null;
  changed_by: string | null;
  consultant_name: string | null;
  consultant_avatar: string | null;
  business_name: string | null;
  business_logo: string | null;
  user_email: string | null;
  note: string | null;
  changed_at: Date;
}

@Injectable()
export class BoardHistoryService implements IBoardHistoryService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
  ) {
    this.logger = new AppLogger(BoardHistoryService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async list(
    projectId: string,
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<BoardTaskHistoryResponseDto>> {
    this.logger.log(
      `[${this.rid}] list — start | projectId: ${projectId}, taskId: ${taskId}, page: ${pageOptions.page}, limit: ${pageOptions.limit}`,
    );
    await this.access.resolveOwnedProject(projectId);
    await this.assertTaskOnBoard(projectId, taskId);

    const allowedTypes = [
      TaskHistoryChangeType.STATUS_CHANGE,
      TaskHistoryChangeType.ASSIGNMENT,
      TaskHistoryChangeType.UNASSIGNMENT,
    ];

    const baseQb = this.uow.taskHistory
      .createQueryBuilder('th')
      .where('th.task_id = :taskId', { taskId })
      .andWhere('th.change_type IN (:...types)', { types: allowedTypes });

    const itemCount = await baseQb.clone().getCount();

    // Single SQL with all joins for author + assignee display. Avoids the
    // per-row roundtrip we'd hit if we resolved names in JavaScript.
    const rows = await baseQb
      .leftJoin('users', 'u', 'u.id = th.changed_by')
      .leftJoin('consultant_profiles', 'cp', 'cp.user_id = u.id')
      .leftJoin('business_profiles', 'bp', 'bp.user_id = u.id')
      .leftJoin('consultant_profiles', 'cp_prev', 'cp_prev.id = th.previous_assigned_to')
      .leftJoin('consultant_profiles', 'cp_new', 'cp_new.id = th.new_assigned_to')
      .select('th.id', 'history_id')
      .addSelect('th.task_id', 'task_id')
      .addSelect('th.change_type', 'change_type')
      .addSelect('th.previous_kanban_status', 'prev_status')
      .addSelect('th.new_kanban_status', 'new_status')
      .addSelect('cp_prev.id', 'prev_consultant_id')
      .addSelect('cp_prev.full_name', 'prev_full_name')
      .addSelect('cp_prev.avatar_url', 'prev_avatar_url')
      .addSelect('cp_new.id', 'new_consultant_id')
      .addSelect('cp_new.full_name', 'new_full_name')
      .addSelect('cp_new.avatar_url', 'new_avatar_url')
      .addSelect('th.changed_by', 'changed_by')
      .addSelect('cp.full_name', 'consultant_name')
      .addSelect('cp.avatar_url', 'consultant_avatar')
      .addSelect('bp.company_name', 'business_name')
      .addSelect('bp.logo_url', 'business_logo')
      .addSelect('u.email', 'user_email')
      .addSelect('th.note', 'note')
      .addSelect('th.changed_at', 'changed_at')
      .orderBy('th.changed_at', 'DESC')
      .addOrderBy('th.id', 'DESC')
      .skip(pageOptions.skip)
      .take(pageOptions.limit)
      .getRawMany<IHistoryRow>();

    const data = rows.map((r) => this.mapRow(r));
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

  private mapRow(r: IHistoryRow): BoardTaskHistoryResponseDto {
    const authorName =
      r.consultant_name ?? r.business_name ?? r.user_email ?? (r.changed_by ? '—' : 'System');
    const authorAvatar = r.consultant_avatar ?? r.business_logo ?? null;

    return plainToInstance(
      BoardTaskHistoryResponseDto,
      {
        id: r.history_id,
        task_id: r.task_id,
        change_type: r.change_type,
        previous_kanban_status: r.prev_status,
        new_kanban_status: r.new_status,
        previous_assignee: r.prev_consultant_id
          ? {
              consultant_id: r.prev_consultant_id,
              full_name: r.prev_full_name ?? '',
              avatar_url: r.prev_avatar_url,
            }
          : null,
        new_assignee: r.new_consultant_id
          ? {
              consultant_id: r.new_consultant_id,
              full_name: r.new_full_name ?? '',
              avatar_url: r.new_avatar_url,
            }
          : null,
        author: {
          user_id: r.changed_by,
          name: authorName,
          avatar_url: authorAvatar,
        },
        note: r.note,
        changed_at: r.changed_at,
      },
      { excludeExtraneousValues: true },
    );
  }
}
