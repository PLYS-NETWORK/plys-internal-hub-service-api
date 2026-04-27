import { AbstractRepository } from '@common/repositories';
import { Task } from '@database/entities';
import { TaskKanbanStatus } from '@database/enums';

export interface ITaskOverdueRow {
  project_id: string;
  project_name: string;
  overdue_count: number;
}

export interface ITaskCompletionRow {
  project_id: string;
  project_name: string;
  total_tasks: number;
  completed_tasks: number;
}

export interface ITaskRepository extends AbstractRepository<Task> {
  /**
   * Counts tasks grouped by `kanban_status` across the given project IDs.
   * Statuses with zero matches are still present (zero-filled) so callers do
   * not need to merge maps.
   *
   * @param projectIds       Universe to aggregate over.
   * @param projectIdFilter  Optional further narrowing to a single project.
   */
  countByProjectIdsGroupedByStatus(
    projectIds: string[],
    projectIdFilter?: string,
  ): Promise<Record<TaskKanbanStatus, number>>;

  /**
   * Returns per-project overdue counts (`due_date < NOW()` and `kanban_status`
   * not in `done`/`cancelled`). Sorted by overdue_count desc. Projects with no
   * overdue tasks are absent from the result.
   */
  countOverdueByProjectIdsGroupedByProject(
    projectIds: string[],
    projectIdFilter?: string,
  ): Promise<ITaskOverdueRow[]>;

  /**
   * Returns per-project completion counters (`total`, `completed`).
   * The completion ratio is computed by the caller — null-safe by definition.
   */
  countCompletionByProjectIdsGroupedByProject(
    projectIds: string[],
    projectIdFilter?: string,
  ): Promise<ITaskCompletionRow[]>;

  /** Total overdue count across the given projects. */
  countOverdueByProjectIds(projectIds: string[]): Promise<number>;

  /** Tasks where `kanban_status <> cancelled` across the given projects. */
  countOpenByProjectIds(projectIds: string[]): Promise<number>;
}
