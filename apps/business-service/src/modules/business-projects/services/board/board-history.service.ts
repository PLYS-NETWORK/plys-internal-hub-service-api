import { HttpStatus, Injectable } from '@nestjs/common';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PageMetaDto } from '@plys/libraries/common-nest/dto/page-meta.dto';
import { PageOptionsDto } from '@plys/libraries/common-nest/dto/page-options.dto';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { UrlResolverService } from '@plys/libraries/common-nest/modules/file-storage';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { TaskHistoryChangeType, TaskKanbanStatus } from '@plys/libraries/database/enums';
import { ProjectsUnitOfWorkService } from '@plys/libraries/unit-of-work/projects-unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ERROR_CODES } from '../../../../errors/error-codes';
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
    private readonly uow: ProjectsUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly urlResolver: UrlResolverService,
  ) {
    this.logger = new AppLogger(BoardHistoryService.name, requestContext);
  }

  /** @inheritdoc */
  public async list(
    projectId: string,
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<BoardTaskHistoryResponseDto>> {
    this.logger.log(
      `list — start | projectId: ${projectId}, taskId: ${taskId}, page: ${pageOptions.page}, limit: ${pageOptions.limit}`,
    );
    await this.access.resolveOwnedProject(projectId);
    await this.assertTaskOnBoard(projectId, taskId);

    const allowedTypes = [
      TaskHistoryChangeType.CREATED,
      TaskHistoryChangeType.EDIT,
      TaskHistoryChangeType.STATUS_CHANGE,
      TaskHistoryChangeType.ASSIGNMENT,
      TaskHistoryChangeType.UNASSIGNMENT,
      TaskHistoryChangeType.PAID,
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

    // Each row has up to three distinct avatar/logo URLs: prev assignee, new
    // assignee, and the author's avatar (consultant_profiles or business_profiles).
    // Re-sign all of them in a single batched call before mapping rows.
    const flatUrls: Array<string | null> = [];
    for (const r of rows) {
      flatUrls.push(r.prev_avatar_url);
      flatUrls.push(r.new_avatar_url);
      flatUrls.push(r.consultant_avatar ?? r.business_logo ?? null);
    }
    const resigned = await this.urlResolver.resolveMany(flatUrls);
    const data = rows.map((r, idx) => {
      const base = idx * 3;
      return this.mapRow(r, {
        prevAvatarUrl: resigned[base],
        newAvatarUrl: resigned[base + 1],
        authorAvatarUrl: resigned[base + 2],
      });
    });
    this.logger.log(
      `list — complete | taskId: ${taskId}, returned: ${data.length}, total: ${itemCount}`,
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

  private mapRow(
    r: IHistoryRow,
    urls: {
      prevAvatarUrl: string | null;
      newAvatarUrl: string | null;
      authorAvatarUrl: string | null;
    },
  ): BoardTaskHistoryResponseDto {
    const authorName =
      r.consultant_name ?? r.business_name ?? r.user_email ?? (r.changed_by ? '—' : 'System');

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
              avatar_url: urls.prevAvatarUrl,
            }
          : null,
        new_assignee: r.new_consultant_id
          ? {
              consultant_id: r.new_consultant_id,
              full_name: r.new_full_name ?? '',
              avatar_url: urls.newAvatarUrl,
            }
          : null,
        author: {
          user_id: r.changed_by,
          name: authorName,
          avatar_url: urls.authorAvatarUrl,
        },
        note: r.note,
        changed_at: r.changed_at,
      },
      { excludeExtraneousValues: true },
    );
  }
}
