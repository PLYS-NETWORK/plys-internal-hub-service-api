import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { UrlResolverService } from '@common/modules/file-storage';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { computeWorkedSeconds, formatWorkedDuration } from '@common/utils/duration';
import { TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ASSIGNEE_ID_UNASSIGNED, ListBoardTasksDto } from '../../dto/requests';
import { BoardTaskDetailResponseDto, BoardTaskResponseDto } from '../../dto/responses';
import { IBoardService } from '../../interfaces/board.service.interface';
import { BusinessAccessService } from '../business-access.service';
import { BoardCacheService } from './board-cache.service';

interface IBoardTaskRow {
  task_id: string;
  task_code: string;
  task_title: string;
  task_description: Record<string, unknown> | null;
  task_kanban_status: TaskKanbanStatus;
  task_price: string;
  task_started_at: Date | null;
  task_completed_at: Date | null;
  task_created_at: Date;
  task_updated_at: Date;
  consultant_id: string | null;
  consultant_full_name: string | null;
  consultant_avatar_url: string | null;
  attachments_count: string | number;
  worked_seconds: string | number;
}

@Injectable()
export class BoardService implements IBoardService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly cache: BoardCacheService,
    private readonly urlResolver: UrlResolverService,
  ) {
    this.logger = new AppLogger(BoardService.name, requestContext);
  }

  /** @inheritdoc */
  public async listTasks(
    projectId: string,
    filters: ListBoardTasksDto,
  ): Promise<PageDto<BoardTaskResponseDto>> {
    const userId = this.requestContext.userId!;
    const tz = this.requestContext.timezone ?? 'UTC';
    const sortBy = filters.sortBy ?? 'updated_at';
    const orderBy = filters.orderBy ?? 'DESC';
    this.logger.log(
      `listTasks — start | projectId: ${projectId}, status: ${filters.status ?? '-'}, assignee: ${
        filters.assigneeId ?? '-'
      }, keywords: ${filters.keywords ?? '-'}, sort: ${sortBy} ${orderBy}, page: ${filters.page}, limit: ${filters.limit}, removeCache: ${filters.isRemoveCache ?? false}`,
    );
    await this.access.resolveOwnedProject(projectId);

    const cacheKey = this.cache.buildKey(projectId, userId, tz, {
      status: filters.status ?? null,
      assigneeId: filters.assigneeId ?? null,
      keywords: filters.keywords ?? null,
      sortBy,
      orderBy,
      page: filters.page,
      limit: filters.limit,
    });

    if (!filters.isRemoveCache) {
      const cached = await this.cache.get<{ data: unknown[]; meta: PageMetaDto }>(cacheKey);
      if (cached) {
        this.logger.log(`listTasks — cache hit | key: ${cacheKey}, count: ${cached.data.length}`);
        // Cache holds the raw storage URLs — re-sign at the response boundary
        // so the cached payload outlives the 15-min S3 presign TTL.
        await this.resignAssigneeAvatars(cached.data);
        const data = cached.data.map((entry) =>
          plainToInstance(BoardTaskResponseDto, entry, { excludeExtraneousValues: true }),
        );
        return new PageDto(data, cached.meta as PageMetaDto);
      }
    } else {
      await this.cache.invalidateKey(cacheKey);
    }

    // Base query with filters only — cloned for COUNT before joins/selects are added.
    const baseQb = this.uow.tasks
      .createQueryBuilder('t')
      .where('t.project_id = :projectId', { projectId })
      .andWhere('t.kanban_status != :draft', { draft: TaskKanbanStatus.DRAFT })
      .andWhere('t.deleted_at IS NULL');

    if (filters.status) {
      baseQb.andWhere('t.kanban_status = :status', { status: filters.status });
    }
    if (filters.assigneeId) {
      if (filters.assigneeId === ASSIGNEE_ID_UNASSIGNED) {
        baseQb.andWhere('t.assigned_to IS NULL');
      } else {
        baseQb.andWhere('t.assigned_to = :assigneeId', { assigneeId: filters.assigneeId });
      }
    }
    if (filters.keywords) {
      baseQb.andWhere('(t.title ILIKE :keywords OR t.code ILIKE :keywords)', {
        keywords: `%${filters.keywords}%`,
      });
    }

    const itemCount = await baseQb.clone().getCount();

    const dataQb = baseQb
      .leftJoin('t.assignee', 'cp')
      .select('t.id', 'task_id')
      .addSelect('t.code', 'task_code')
      .addSelect('t.title', 'task_title')
      .addSelect('t.description', 'task_description')
      .addSelect('t.kanban_status', 'task_kanban_status')
      .addSelect('t.price', 'task_price')
      .addSelect('t.started_at', 'task_started_at')
      .addSelect('t.completed_at', 'task_completed_at')
      .addSelect('t.created_at', 'task_created_at')
      .addSelect('t.updated_at', 'task_updated_at')
      .addSelect('cp.id', 'consultant_id')
      .addSelect('cp.full_name', 'consultant_full_name')
      .addSelect('cp.avatar_url', 'consultant_avatar_url')
      .addSelect(
        '(SELECT COUNT(*)::int FROM task_attachments ta WHERE ta.task_id = t.id AND ta.deleted_at IS NULL)',
        'attachments_count',
      )
      .addSelect(
        `EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.started_at))`,
        'worked_seconds',
      );

    // Stable secondary sort on id keeps pagination deterministic when the
    // primary sort key has ties (multiple tasks sharing the same updated_at).
    if (sortBy === 'total_worked_hours') {
      // NULLS LAST on ASC, NULLS FIRST on DESC mirrors the user's expectation
      // that "no time logged" sorts to the bottom of an ascending list and to
      // the top of a descending one.
      dataQb.orderBy(
        `EXTRACT(EPOCH FROM (COALESCE(t.completed_at, NOW()) - t.started_at))`,
        orderBy,
        orderBy === 'ASC' ? 'NULLS LAST' : 'NULLS FIRST',
      );
    } else if (sortBy === 'created_at') {
      dataQb.orderBy('t.created_at', orderBy);
    } else {
      dataQb.orderBy('t.updated_at', orderBy);
    }
    dataQb.addOrderBy('t.id', 'ASC').skip(filters.skip).take(filters.limit);

    const rows = await dataQb.getRawMany<IBoardTaskRow>();
    const data = rows.map((r) => this.mapRow(r));

    const meta = new PageMetaDto({ pageOptionsDto: filters, itemCount });
    const result = new PageDto(data, meta);
    // Cache holds the raw URLs produced by `mapRow`; re-sign on the response
    // boundary so neither the cache nor the response carries an expired URL.
    await this.cache.set(cacheKey, result);
    await this.resignAssigneeAvatars(data);

    this.logger.log(
      `listTasks — complete | projectId: ${projectId}, count: ${data.length}, total: ${itemCount}, cached: true`,
    );
    return result;
  }

  /** @inheritdoc */
  public async getTaskDetail(
    projectId: string,
    taskId: string,
  ): Promise<BoardTaskDetailResponseDto> {
    this.logger.log(`getTaskDetail — start | projectId: ${projectId}, taskId: ${taskId}`);
    await this.access.resolveOwnedProject(projectId);

    const task = await this.uow.tasks.findOne({
      where: { id: taskId, projectId },
      relations: { assignee: true },
    });
    if (!task || task.kanbanStatus === TaskKanbanStatus.DRAFT) {
      this.logger.warn(`getTaskDetail — not found or draft | taskId: ${taskId}`);
      throw new TranslatableException({
        messageKey: 'error.task.not_found',
        errorCode: ERROR_CODES.TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const attachmentRows = await this.uow.taskAttachments.find({
      where: { taskId },
      order: { uploadedAt: 'ASC' },
    });

    const totalSeconds = computeWorkedSeconds(task.startedAt, task.completedAt);
    const workedDuration = formatWorkedDuration(totalSeconds);

    this.logger.log(
      `getTaskDetail — complete | taskId: ${taskId}, attachments: ${attachmentRows.length}`,
    );
    const assigneeAvatar = task.assignee
      ? await this.urlResolver.resolve(task.assignee.avatarUrl)
      : null;

    return plainToInstance(
      BoardTaskDetailResponseDto,
      {
        id: task.id,
        code: task.code,
        title: task.title,
        description: task.description,
        kanban_status: task.kanbanStatus,
        price: Number(task.price).toFixed(2),
        assignee: task.assignee
          ? {
              consultant_id: task.assignee.id,
              full_name: task.assignee.fullName,
              avatar_url: assigneeAvatar,
            }
          : null,
        total_time_worked: workedDuration,
        attachments_count: attachmentRows.length,
        last_update: task.updatedAt,
        created_day: task.createdAt,
        approved_by: task.approvedBy,
        approved_at: task.approvedAt,
        started_at: task.startedAt,
        completed_at: task.completedAt,
        attachments: attachmentRows.map((a) => ({
          id: a.id,
          file_id: a.fileId,
          file_name: a.fileName,
          mime_type: a.mimeType,
          file_size_bytes: a.fileSizeBytes === null ? null : Number(a.fileSizeBytes),
          uploaded_at: a.uploadedAt,
        })),
      },
      { excludeExtraneousValues: true },
    );
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Mutates each entry's `assignee.avatar_url` so every value is freshly
   * presigned. Runs at the response boundary on both cache-hit and cache-miss
   * paths so cached payloads never serve an expired URL.
   */
  private async resignAssigneeAvatars(rows: ReadonlyArray<unknown>): Promise<void> {
    const assignees = rows
      .map((row) => (row as { assignee?: { avatar_url?: string | null } | null }).assignee)
      .filter((a): a is { avatar_url?: string | null } => a !== null && a !== undefined);
    if (assignees.length === 0) return;
    const resigned = await this.urlResolver.resolveMany(assignees.map((a) => a.avatar_url));
    assignees.forEach((a, idx) => {
      a.avatar_url = resigned[idx];
    });
  }

  private mapRow(r: IBoardTaskRow): BoardTaskResponseDto {
    const totalSeconds = Number(r.worked_seconds ?? 0);
    const safeSeconds = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
    return plainToInstance(
      BoardTaskResponseDto,
      {
        id: r.task_id,
        code: r.task_code,
        title: r.task_title,
        description: r.task_description,
        kanban_status: r.task_kanban_status,
        price: Number(r.task_price).toFixed(2),
        assignee: r.consultant_id
          ? {
              consultant_id: r.consultant_id,
              full_name: r.consultant_full_name ?? '',
              avatar_url: r.consultant_avatar_url,
            }
          : null,
        total_time_worked: formatWorkedDuration(safeSeconds),
        attachments_count: Number(r.attachments_count ?? 0),
        last_update: r.task_updated_at,
        created_day: r.task_created_at,
      },
      { excludeExtraneousValues: true },
    );
  }
}
