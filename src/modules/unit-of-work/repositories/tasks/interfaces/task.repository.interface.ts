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

/** Health aggregate for one project, used by the business-dashboard project-health table. */
export interface IProjectHealthAggregate {
  project_id: string;
  total: number;
  completed: number;
  in_review: number;
  overdue: number;
  /** Most recent `task.updated_at` across the project's tasks (null when the project has none). */
  last_activity_at: Date | null;
  /** Earliest `task.updated_at` for currently-IN_REVIEW rows (null when none). */
  oldest_in_review_at: Date | null;
}

/** Consultant performance aggregate, used by the team-performance table. */
export interface IConsultantPerformanceAggregate {
  consultant_id: string;
  completed: number;
  in_progress: number;
  /** Mean (`completed_at - started_at`) in days over DONE rows in the window; `null` when none. */
  avg_cycle_days: number | null;
  /** Count of DONE rows where `completed_at <= due_date` in the window. */
  on_time: number;
  /** Total DONE rows in the window (denominator for `on_time_pct`). */
  total_done: number;
}

/** Action-item row: a task awaiting business-owner review. */
export interface ITaskActionItemRow {
  task_id: string;
  task_code: string;
  title: string;
  project_id: string;
  project_title: string;
  /** For `awaiting-review`: `updated_at` (when the row entered IN_REVIEW). For `overdue`: `due_date`. */
  reference_at: Date;
  /** For `overdue`: integer days past `due_date`. `null` for non-overdue rows. */
  days_overdue: number | null;
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

  /**
   * Counts a single consultant's tasks in one project grouped by
   * `kanban_status`. All statuses are zero-filled. DRAFT tasks (which are not
   * "assigned" in any meaningful sense) are excluded.
   */
  countByAssigneeAndProjectGroupedByStatus(
    consultantId: string,
    projectId: string,
  ): Promise<Record<TaskKanbanStatus, number>>;

  /**
   * True when the consultant currently has another in-progress task assigned
   * to them (across any project). Used to enforce the
   * "one in-progress task per consultant" invariant before a status flip to
   * IN_PROGRESS. `excludeTaskId` lets the caller ignore the row it is about
   * to update.
   */
  existsInProgressByAssignee(consultantId: string, excludeTaskId?: string): Promise<boolean>;

  /**
   * Returns the average price for several projects in one round-trip. Each
   * project that has at least one non-DRAFT/non-CANCELLED task gets an entry;
   * projects without qualifying tasks are absent from the map.
   */
  avgPriceByProjectIds(projectIds: string[]): Promise<Map<string, number>>;

  /**
   * Count of DONE tasks across `projectIds` whose `completed_at` falls in the
   * `[from, to]` window. Used by throughput KPI `tasks_completed_mtd` and by
   * the per-consultant performance aggregate.
   */
  countCompletedByProjectIdsBetween(projectIds: string[], from: Date, to: Date): Promise<number>;

  /**
   * Mean cycle time in days over DONE tasks where `completed_at` falls in the
   * window. `null` when no qualifying rows. Uses
   * `EXTRACT(EPOCH FROM completed_at - started_at) / 86400`.
   */
  avgCycleDaysByProjectIdsBetween(
    projectIds: string[],
    from: Date,
    to: Date,
  ): Promise<number | null>;

  /**
   * On-time delivery counters for the throughput KPI:
   *   `total` = DONE tasks completed in the window (denominator)
   *   `onTime` = subset of those where `completed_at <= due_date`
   * Rows missing `due_date` are excluded from both counters — they have no
   * SLA to measure against.
   */
  countOnTimeByProjectIdsBetween(
    projectIds: string[],
    from: Date,
    to: Date,
  ): Promise<{ onTime: number; total: number }>;

  /**
   * SUM(task.price) for tasks belonging to a business's unpublished projects
   * (status IN draft / configured) excluding CANCELLED tasks. Returned as a
   * fixed-point decimal string so callers can pass straight to `Money`.
   */
  sumUnpublishedTaskPricesByBusinessId(businessId: string): Promise<string>;

  /**
   * Top-N rows currently in IN_REVIEW status across the given projects,
   * sorted by `updated_at` ASC (oldest first — that's the action queue order).
   * Includes the owning project's title via JOIN so the action-items endpoint
   * can render without a second round-trip.
   */
  findAwaitingReviewByProjectIds(
    projectIds: string[],
    limit: number,
  ): Promise<ITaskActionItemRow[]>;

  /**
   * Top-N overdue rows (`due_date < NOW()` and status NOT IN done/cancelled)
   * sorted by `due_date` ASC. `days_overdue` is integer days past `due_date`
   * computed by Postgres.
   */
  findOverdueByProjectIds(projectIds: string[], limit: number): Promise<ITaskActionItemRow[]>;

  /**
   * Single grouped query returning a health aggregate per project — total /
   * completed / in_review / overdue counts plus the latest task activity and
   * the oldest in-review timestamp (used by the at-risk flag).
   */
  aggregateHealthByProjectIds(projectIds: string[]): Promise<IProjectHealthAggregate[]>;

  /**
   * Single grouped query keyed by `assigned_to` returning the per-consultant
   * performance aggregate over the given projects + window. Consultants with
   * no tasks in the window are absent from the result.
   */
  aggregatePerformanceByAssigneesBetween(
    projectIds: string[],
    consultantIds: string[],
    from: Date,
    to: Date,
  ): Promise<IConsultantPerformanceAggregate[]>;
}
