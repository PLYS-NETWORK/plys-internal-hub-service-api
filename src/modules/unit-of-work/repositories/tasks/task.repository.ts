import { AbstractRepository } from '@common/repositories';
import { Task } from '@database/entities';
import { TASK_KANBAN_STATUSES, TaskKanbanStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, SelectQueryBuilder } from 'typeorm';

import { ITaskCompletionRow, ITaskOverdueRow, ITaskRepository } from './interfaces';

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

  private applyProjectIdFilter(qb: SelectQueryBuilder<Task>, projectIdFilter?: string): void {
    if (projectIdFilter) {
      qb.andWhere('task.project_id = :projectIdFilter', { projectIdFilter });
    }
  }
}
