import { AbstractRepository } from '@common/repositories';
import { Task } from '@database/entities';
import { TASK_KANBAN_STATUSES, TaskKanbanStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, SelectQueryBuilder } from 'typeorm';

import {
  IConsultantPerformanceAggregate,
  IProjectHealthAggregate,
  ITaskActionItemRow,
  ITaskCompletionRow,
  ITaskOverdueRow,
  ITaskRepository,
} from './interfaces';

@Injectable()
export class TaskRepository extends AbstractRepository<Task> implements ITaskRepository {
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(Task, manager);
  }

  public withManager(manager: EntityManager): this {
    return new TaskRepository(manager) as this;
  }

  /** @inheritdoc */
  public async countByProjectIdsGroupedByStatus(
    projectIds: string[],
    projectIdFilter?: string,
  ): Promise<Record<TaskKanbanStatus, number>> {
    const out = {} as Record<TaskKanbanStatus, number>;
    for (const status of TASK_KANBAN_STATUSES) out[status] = 0;
    if (projectIds.length === 0) return out;

    const qb = this.createQueryBuilder('task')
      .select('task.kanban_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.deleted_at IS NULL');

    this.applyProjectIdFilter(qb, projectIdFilter);

    const rows = await qb
      .groupBy('task.kanban_status')
      .getRawMany<{ status: TaskKanbanStatus; count: string }>();

    for (const row of rows) out[row.status] = Number(row.count);
    return out;
  }

  /** @inheritdoc */
  public async countOverdueByProjectIdsGroupedByProject(
    projectIds: string[],
    projectIdFilter?: string,
  ): Promise<ITaskOverdueRow[]> {
    if (projectIds.length === 0) return [];

    const qb = this.createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('project.id', 'project_id')
      .addSelect('project.title', 'project_name')
      .addSelect('COUNT(*)', 'overdue_count')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.deleted_at IS NULL')
      .andWhere('task.due_date IS NOT NULL')
      .andWhere('task.due_date < NOW()')
      .andWhere(
        `task.kanban_status NOT IN ('${TaskKanbanStatus.DONE}', '${TaskKanbanStatus.CANCELLED}')`,
      );

    this.applyProjectIdFilter(qb, projectIdFilter);

    const rows = await qb
      .groupBy('project.id')
      .addGroupBy('project.title')
      .orderBy('overdue_count', 'DESC')
      .getRawMany<{ project_id: string; project_name: string; overdue_count: string }>();

    return rows.map((r) => ({
      project_id: r.project_id,
      project_name: r.project_name,
      overdue_count: Number(r.overdue_count),
    }));
  }

  /** @inheritdoc */
  public async countCompletionByProjectIdsGroupedByProject(
    projectIds: string[],
    projectIdFilter?: string,
  ): Promise<ITaskCompletionRow[]> {
    if (projectIds.length === 0) return [];

    const qb = this.createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('project.id', 'project_id')
      .addSelect('project.title', 'project_name')
      .addSelect('COUNT(*)', 'total_tasks')
      .addSelect(
        `COUNT(*) FILTER (WHERE task.kanban_status = '${TaskKanbanStatus.DONE}')`,
        'completed_tasks',
      )
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.deleted_at IS NULL');

    this.applyProjectIdFilter(qb, projectIdFilter);

    const rows = await qb.groupBy('project.id').addGroupBy('project.title').getRawMany<{
      project_id: string;
      project_name: string;
      total_tasks: string;
      completed_tasks: string;
    }>();

    return rows.map((r) => ({
      project_id: r.project_id,
      project_name: r.project_name,
      total_tasks: Number(r.total_tasks),
      completed_tasks: Number(r.completed_tasks),
    }));
  }

  /** @inheritdoc */
  public async countOverdueByProjectIds(projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;
    const row = await this.createQueryBuilder('task')
      .select('COUNT(*)', 'count')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.deleted_at IS NULL')
      .andWhere('task.due_date IS NOT NULL')
      .andWhere('task.due_date < NOW()')
      .andWhere(
        `task.kanban_status NOT IN ('${TaskKanbanStatus.DONE}', '${TaskKanbanStatus.CANCELLED}')`,
      )
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  /** @inheritdoc */
  public async countOpenByProjectIds(projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;
    const row = await this.createQueryBuilder('task')
      .select('COUNT(*)', 'count')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.deleted_at IS NULL')
      .andWhere(`task.kanban_status <> '${TaskKanbanStatus.CANCELLED}'`)
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  /** @inheritdoc */
  public async countByAssigneeAndProjectGroupedByStatus(
    consultantId: string,
    projectId: string,
  ): Promise<Record<TaskKanbanStatus, number>> {
    const out = {} as Record<TaskKanbanStatus, number>;
    for (const status of TASK_KANBAN_STATUSES) out[status] = 0;

    const rows = await this.createQueryBuilder('task')
      .select('task.kanban_status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('task.assigned_to = :consultantId', { consultantId })
      .andWhere('task.project_id = :projectId', { projectId })
      .andWhere(`task.kanban_status <> '${TaskKanbanStatus.DRAFT}'`)
      .andWhere('task.deleted_at IS NULL')
      .groupBy('task.kanban_status')
      .getRawMany<{ status: TaskKanbanStatus; count: string }>();

    for (const row of rows) out[row.status] = Number(row.count);
    return out;
  }

  /** @inheritdoc */
  public async existsInProgressByAssignee(
    consultantId: string,
    excludeTaskId?: string,
  ): Promise<boolean> {
    const qb = this.createQueryBuilder('task')
      .select('1', 'present')
      .where('task.assigned_to = :consultantId', { consultantId })
      .andWhere(`task.kanban_status = '${TaskKanbanStatus.IN_PROGRESS}'`)
      .andWhere('task.deleted_at IS NULL');
    if (excludeTaskId) qb.andWhere('task.id <> :excludeTaskId', { excludeTaskId });
    const row = await qb.limit(1).getRawOne<{ present: number }>();
    return row !== undefined;
  }

  /** @inheritdoc */
  public async avgPriceByProjectIds(projectIds: string[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();

    const rows = await this.createQueryBuilder('task')
      .select('task.project_id', 'project_id')
      .addSelect('AVG(task.price)::numeric(10,2)', 'avg_price')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.deleted_at IS NULL')
      .andWhere(
        `task.kanban_status NOT IN ('${TaskKanbanStatus.DRAFT}', '${TaskKanbanStatus.CANCELLED}')`,
      )
      .groupBy('task.project_id')
      .getRawMany<{ project_id: string; avg_price: string | null }>();

    const out = new Map<string, number>();
    for (const row of rows) {
      if (row.avg_price !== null) out.set(row.project_id, Number(row.avg_price));
    }
    return out;
  }

  /** @inheritdoc */
  public async countCompletedByProjectIdsBetween(
    projectIds: string[],
    from: Date,
    to: Date,
  ): Promise<number> {
    if (projectIds.length === 0) return 0;
    const row = await this.createQueryBuilder('task')
      .select('COUNT(*)', 'count')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.deleted_at IS NULL')
      .andWhere(`task.kanban_status = '${TaskKanbanStatus.DONE}'`)
      .andWhere('task.completed_at >= :from', { from })
      .andWhere('task.completed_at <= :to', { to })
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  /** @inheritdoc */
  public async avgCycleDaysByProjectIdsBetween(
    projectIds: string[],
    from: Date,
    to: Date,
  ): Promise<number | null> {
    if (projectIds.length === 0) return null;
    const row = await this.createQueryBuilder('task')
      .select('AVG(EXTRACT(EPOCH FROM (task.completed_at - task.started_at)) / 86400)', 'avg_days')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.deleted_at IS NULL')
      .andWhere(`task.kanban_status = '${TaskKanbanStatus.DONE}'`)
      .andWhere('task.completed_at IS NOT NULL')
      .andWhere('task.started_at IS NOT NULL')
      .andWhere('task.completed_at >= :from', { from })
      .andWhere('task.completed_at <= :to', { to })
      .getRawOne<{ avg_days: string | null }>();
    return row?.avg_days !== null && row?.avg_days !== undefined ? Number(row.avg_days) : null;
  }

  /** @inheritdoc */
  public async countOnTimeByProjectIdsBetween(
    projectIds: string[],
    from: Date,
    to: Date,
  ): Promise<{ onTime: number; total: number }> {
    if (projectIds.length === 0) return { onTime: 0, total: 0 };
    const row = await this.createQueryBuilder('task')
      .select('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE task.completed_at <= task.due_date)', 'on_time')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.deleted_at IS NULL')
      .andWhere(`task.kanban_status = '${TaskKanbanStatus.DONE}'`)
      .andWhere('task.completed_at IS NOT NULL')
      .andWhere('task.due_date IS NOT NULL')
      .andWhere('task.completed_at >= :from', { from })
      .andWhere('task.completed_at <= :to', { to })
      .getRawOne<{ total: string; on_time: string }>();
    return {
      onTime: Number(row?.on_time ?? 0),
      total: Number(row?.total ?? 0),
    };
  }

  /** @inheritdoc */
  public async sumUnpublishedTaskPricesByBusinessId(businessId: string): Promise<string> {
    const row = await this.createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('COALESCE(SUM(task.price), 0)', 'amount')
      .where('project.business_id = :businessId', { businessId })
      .andWhere('project.deleted_at IS NULL')
      .andWhere(`project.status IN ('draft', 'configured')`)
      .andWhere('task.deleted_at IS NULL')
      .andWhere(`task.kanban_status <> '${TaskKanbanStatus.CANCELLED}'`)
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }

  /** @inheritdoc */
  public async sumDraftPricesByProjectId(projectId: string): Promise<string> {
    const row = await this.createQueryBuilder('task')
      .select('COALESCE(SUM(task.price), 0)', 'amount')
      .where('task.project_id = :projectId', { projectId })
      .andWhere('task.deleted_at IS NULL')
      .andWhere(`task.kanban_status = '${TaskKanbanStatus.DRAFT}'`)
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }

  /** @inheritdoc */
  public async findAwaitingReviewByProjectIds(
    projectIds: string[],
    limit: number,
  ): Promise<ITaskActionItemRow[]> {
    if (projectIds.length === 0) return [];
    const rows = await this.createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('task.id', 'task_id')
      .addSelect('task.code', 'task_code')
      .addSelect('task.title', 'title')
      .addSelect('project.id', 'project_id')
      .addSelect('project.title', 'project_title')
      .addSelect('task.updated_at', 'reference_at')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.deleted_at IS NULL')
      .andWhere(`task.kanban_status = '${TaskKanbanStatus.IN_REVIEW}'`)
      .orderBy('task.updated_at', 'ASC')
      .limit(limit)
      .getRawMany<{
        task_id: string;
        task_code: string;
        title: string;
        project_id: string;
        project_title: string;
        reference_at: Date;
      }>();
    return rows.map((r) => ({ ...r, days_overdue: null }));
  }

  /** @inheritdoc */
  public async findOverdueByProjectIds(
    projectIds: string[],
    limit: number,
  ): Promise<ITaskActionItemRow[]> {
    if (projectIds.length === 0) return [];
    const rows = await this.createQueryBuilder('task')
      .innerJoin('task.project', 'project')
      .select('task.id', 'task_id')
      .addSelect('task.code', 'task_code')
      .addSelect('task.title', 'title')
      .addSelect('project.id', 'project_id')
      .addSelect('project.title', 'project_title')
      .addSelect('task.due_date', 'reference_at')
      .addSelect('EXTRACT(DAY FROM (NOW() - task.due_date))::int', 'days_overdue')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.deleted_at IS NULL')
      .andWhere('task.due_date IS NOT NULL')
      .andWhere('task.due_date < NOW()')
      .andWhere(
        `task.kanban_status NOT IN ('${TaskKanbanStatus.DONE}', '${TaskKanbanStatus.CANCELLED}')`,
      )
      .orderBy('task.due_date', 'ASC')
      .limit(limit)
      .getRawMany<{
        task_id: string;
        task_code: string;
        title: string;
        project_id: string;
        project_title: string;
        reference_at: Date;
        days_overdue: number;
      }>();
    return rows.map((r) => ({
      task_id: r.task_id,
      task_code: r.task_code,
      title: r.title,
      project_id: r.project_id,
      project_title: r.project_title,
      reference_at: r.reference_at,
      days_overdue: Number(r.days_overdue),
    }));
  }

  /** @inheritdoc */
  public async aggregateHealthByProjectIds(
    projectIds: string[],
  ): Promise<IProjectHealthAggregate[]> {
    if (projectIds.length === 0) return [];
    const rows = await this.createQueryBuilder('task')
      .select('task.project_id', 'project_id')
      .addSelect('COUNT(*)::int', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE task.kanban_status = '${TaskKanbanStatus.DONE}')::int`,
        'completed',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE task.kanban_status = '${TaskKanbanStatus.IN_REVIEW}')::int`,
        'in_review',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE task.due_date IS NOT NULL AND task.due_date < NOW() AND task.kanban_status NOT IN ('${TaskKanbanStatus.DONE}', '${TaskKanbanStatus.CANCELLED}'))::int`,
        'overdue',
      )
      .addSelect('MAX(task.updated_at)', 'last_activity_at')
      .addSelect(
        `MIN(task.updated_at) FILTER (WHERE task.kanban_status = '${TaskKanbanStatus.IN_REVIEW}')`,
        'oldest_in_review_at',
      )
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.deleted_at IS NULL')
      .groupBy('task.project_id')
      .getRawMany<{
        project_id: string;
        total: number;
        completed: number;
        in_review: number;
        overdue: number;
        last_activity_at: Date | null;
        oldest_in_review_at: Date | null;
      }>();
    return rows.map((r) => ({
      project_id: r.project_id,
      total: Number(r.total),
      completed: Number(r.completed),
      in_review: Number(r.in_review),
      overdue: Number(r.overdue),
      last_activity_at: r.last_activity_at,
      oldest_in_review_at: r.oldest_in_review_at,
    }));
  }

  /** @inheritdoc */
  public async aggregatePerformanceByAssigneesBetween(
    projectIds: string[],
    consultantIds: string[],
    from: Date,
    to: Date,
  ): Promise<IConsultantPerformanceAggregate[]> {
    if (projectIds.length === 0 || consultantIds.length === 0) return [];
    const rows = await this.createQueryBuilder('task')
      .select('task.assigned_to', 'consultant_id')
      // Completed tasks finished by this consultant in the window.
      .addSelect(
        `COUNT(*) FILTER (WHERE task.kanban_status = '${TaskKanbanStatus.DONE}' AND task.completed_at >= :from AND task.completed_at <= :to)::int`,
        'completed',
      )
      // Currently in progress (regardless of window).
      .addSelect(
        `COUNT(*) FILTER (WHERE task.kanban_status = '${TaskKanbanStatus.IN_PROGRESS}')::int`,
        'in_progress',
      )
      .addSelect(
        `AVG(EXTRACT(EPOCH FROM (task.completed_at - task.started_at)) / 86400)
           FILTER (
             WHERE task.kanban_status = '${TaskKanbanStatus.DONE}'
               AND task.completed_at IS NOT NULL
               AND task.started_at IS NOT NULL
               AND task.completed_at >= :from AND task.completed_at <= :to
           )`,
        'avg_cycle_days',
      )
      .addSelect(
        `COUNT(*) FILTER (
           WHERE task.kanban_status = '${TaskKanbanStatus.DONE}'
             AND task.completed_at IS NOT NULL
             AND task.due_date IS NOT NULL
             AND task.completed_at <= task.due_date
             AND task.completed_at >= :from AND task.completed_at <= :to
         )::int`,
        'on_time',
      )
      .addSelect(
        `COUNT(*) FILTER (
           WHERE task.kanban_status = '${TaskKanbanStatus.DONE}'
             AND task.completed_at IS NOT NULL
             AND task.due_date IS NOT NULL
             AND task.completed_at >= :from AND task.completed_at <= :to
         )::int`,
        'total_done',
      )
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.assigned_to IN (:...consultantIds)', { consultantIds })
      .andWhere('task.deleted_at IS NULL')
      .setParameters({ from, to })
      .groupBy('task.assigned_to')
      .getRawMany<{
        consultant_id: string;
        completed: number;
        in_progress: number;
        avg_cycle_days: string | null;
        on_time: number;
        total_done: number;
      }>();
    return rows.map((r) => ({
      consultant_id: r.consultant_id,
      completed: Number(r.completed),
      in_progress: Number(r.in_progress),
      avg_cycle_days: r.avg_cycle_days !== null ? Number(r.avg_cycle_days) : null,
      on_time: Number(r.on_time),
      total_done: Number(r.total_done),
    }));
  }

  private applyProjectIdFilter(qb: SelectQueryBuilder<Task>, projectIdFilter?: string): void {
    if (projectIdFilter) {
      qb.andWhere('task.project_id = :projectIdFilter', { projectIdFilter });
    }
  }

  /** @inheritdoc */
  public async findVisibleForConsultant(params: {
    projectId: string;
    consultantId: string;
    keyword?: string;
    skip: number;
    take: number;
  }): Promise<[Task[], number]> {
    const { projectId, consultantId, keyword, skip, take } = params;

    const qb = this.createQueryBuilder('task')
      .where('task.project_id = :projectId', { projectId })
      .andWhere('task.deleted_at IS NULL')
      .andWhere(
        // Visibility = unassigned TO_DO ∪ caller-owned non-DRAFT.
        `(
          (task.assigned_to IS NULL AND task.kanban_status = :toDoStatus)
          OR
          (task.assigned_to = :consultantId AND task.kanban_status <> :draftStatus)
        )`,
        {
          toDoStatus: TaskKanbanStatus.TO_DO,
          draftStatus: TaskKanbanStatus.DRAFT,
          consultantId,
        },
      );

    if (keyword && keyword.trim().length > 0) {
      const like = `%${keyword.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(task.title) LIKE :kw OR LOWER(task.code) LIKE :kw)', { kw: like });
    }

    // Status priority bucket — keeps active work surfaced before done/cancelled.
    qb.addSelect(
      `CASE task.kanban_status
        WHEN '${TaskKanbanStatus.IN_PROGRESS}' THEN 1
        WHEN '${TaskKanbanStatus.TO_DO}' THEN 2
        WHEN '${TaskKanbanStatus.IN_REVIEW}' THEN 3
        WHEN '${TaskKanbanStatus.PENDING_APPROVAL}' THEN 4
        WHEN '${TaskKanbanStatus.REVISION_REQUESTED}' THEN 5
        WHEN '${TaskKanbanStatus.DONE}' THEN 6
        WHEN '${TaskKanbanStatus.CANCELLED}' THEN 7
        ELSE 8
      END`,
      'status_rank',
    )
      .orderBy('status_rank', 'ASC')
      .addOrderBy('task.created_at', 'DESC')
      .addOrderBy('task.id', 'ASC')
      .skip(skip)
      .take(take);

    return qb.getManyAndCount();
  }

  /** @inheritdoc */
  public async countCompletedByAssigneeAndProjectIds(
    consultantId: string,
    projectIds: string[],
  ): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();

    const rows = await this.createQueryBuilder('task')
      .select('task.project_id', 'project_id')
      .addSelect('COUNT(*)::int', 'count')
      .where('task.project_id IN (:...projectIds)', { projectIds })
      .andWhere('task.assigned_to = :consultantId', { consultantId })
      .andWhere(`task.kanban_status = '${TaskKanbanStatus.DONE}'`)
      .andWhere('task.deleted_at IS NULL')
      .groupBy('task.project_id')
      .getRawMany<{ project_id: string; count: number }>();

    const out = new Map<string, number>();
    for (const row of rows) out.set(row.project_id, Number(row.count));
    return out;
  }

  /** @inheritdoc */
  public async lockToDoUnassignedTaskById(projectId: string, taskId: string): Promise<Task | null> {
    // FOR UPDATE SKIP LOCKED: concurrent claimants either win the row or
    // observe null — the lost-race path translates to TASK_NOT_CLAIMABLE.
    const row = await this.createQueryBuilder('task')
      .where('task.id = :taskId', { taskId })
      .andWhere('task.project_id = :projectId', { projectId })
      .andWhere(`task.kanban_status = '${TaskKanbanStatus.TO_DO}'`)
      .andWhere('task.assigned_to IS NULL')
      .andWhere('task.deleted_at IS NULL')
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked')
      .getOne();
    return row ?? null;
  }

  /** @inheritdoc */
  public async lockTaskForOwner(
    projectId: string,
    taskId: string,
    consultantId: string,
    expectedStatuses: TaskKanbanStatus[],
  ): Promise<Task | null> {
    if (expectedStatuses.length === 0) return null;
    const row = await this.createQueryBuilder('task')
      .where('task.id = :taskId', { taskId })
      .andWhere('task.project_id = :projectId', { projectId })
      .andWhere('task.assigned_to = :consultantId', { consultantId })
      .andWhere('task.kanban_status IN (:...expectedStatuses)', { expectedStatuses })
      .andWhere('task.deleted_at IS NULL')
      .setLock('pessimistic_write')
      .getOne();
    return row ?? null;
  }
}
