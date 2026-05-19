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

/**
 * Consultant-side action-item row. Carries the kanban_status for callers that
 * surface mixed statuses (overdue can be any non-DONE/non-CANCELLED status,
 * pending-approval can be IN_REVIEW or PENDING_APPROVAL).
 */
export interface IConsultantTaskActionItemRow {
  task_id: string;
  task_code: string;
  title: string;
  project_id: string;
  project_title: string;
  kanban_status: string;
  due_date: Date | null;
  /** Last update timestamp; reflects entry into the current status. */
  updated_at: Date;
  /** Populated only when the row is overdue; null otherwise. */
  days_overdue: number | null;
}

/**
 * Aggregate row used by the consultant project-progress endpoint — one row per
 * (project, status) pair limited to the caller's assigned tasks.
 */
export interface IConsultantProjectTaskBreakdownRow {
  project_id: string;
  kanban_status: string;
  count: number;
  /** True when the row is overdue. Computed Postgres-side. */
  overdue_count: number;
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
   * SUM(task.price) for DRAFT tasks within a single project (excluding
   * soft-deleted rows). Used by the project-overview
   * `money.unpublished_pipeline_value` KPI — money waiting to be paid and
   * promoted onto the board.
   */
  sumDraftPricesByProjectId(projectId: string): Promise<string>;

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

  /**
   * Paginated visibility query for the consultant joined-project task list.
   * Returns tasks where either (a) the task is unassigned and in TO_DO
   * (claimable by anyone) OR (b) the task is assigned to the given consultant
   * and not in DRAFT. Soft-deleted rows are excluded. Results are ordered with
   * IN_PROGRESS first, then TO_DO, then the remaining review/done/cancelled
   * buckets — mirrors the consultant's mental "what needs my attention" order.
   *
   * @param params projectId + consultantId + optional case-insensitive keyword
   *               match on `title` OR `code` + skip/take for pagination.
   * @returns `[rows, total]` tuple compatible with `PageMetaDto`.
   */
  findVisibleForConsultant(params: {
    projectId: string;
    consultantId: string;
    keyword?: string;
    skip: number;
    take: number;
  }): Promise<[Task[], number]>;

  /**
   * Count of DONE tasks per project that were completed by a single
   * consultant. One round-trip via grouped scan; projects with zero matches
   * are absent from the returned map. Powers the `completed_tasks_by_me`
   * column in the joined-projects list.
   */
  countCompletedByAssigneeAndProjectIds(
    consultantId: string,
    projectIds: string[],
  ): Promise<Map<string, number>>;

  /**
   * Race-safe self-assign primitive. Locks the task row with `FOR UPDATE SKIP
   * LOCKED` only when status is TO_DO and `assigned_to IS NULL` — concurrent
   * claims see `null` and back off (caller throws `TASK_NOT_CLAIMABLE`).
   * Returns the locked row so the caller can mutate it inside the same
   * transaction. Soft-deleted rows are ignored.
   *
   * @throws Nothing — surfaces `null` for every "cannot claim" path so the
   *         caller controls the error code.
   */
  lockToDoUnassignedTaskById(projectId: string, taskId: string): Promise<Task | null>;

  /**
   * Locks a task that the consultant already owns for in-place state
   * transitions (unassign, submit-for-review). Filters by `assigned_to =
   * consultantId` and a whitelist of expected statuses; returns `null` when
   * the row is missing, not owned, in the wrong status, or soft-deleted. The
   * caller is responsible for disambiguating those cases via a non-locking
   * pre-fetch when they need to emit specific error codes.
   */
  lockTaskForOwner(
    projectId: string,
    taskId: string,
    consultantId: string,
    expectedStatuses: TaskKanbanStatus[],
  ): Promise<Task | null>;

  /**
   * Counts the caller's assigned tasks (`assigned_to = consultantId`) grouped
   * by `kanban_status`. DRAFT and CANCELLED are still zero-filled so the
   * caller can read every bucket without merge logic. Used by the consultant
   * dashboard summary `portfolio` + `throughput` blocks.
   */
  countByAssigneeGroupedByStatus(consultantId: string): Promise<Record<TaskKanbanStatus, number>>;

  /**
   * Count of DONE tasks whose `assigned_to = consultantId` and whose
   * `completed_at` falls in the `[from, to]` window. Used by the dashboard
   * `tasks_completed_mtd` throughput KPI.
   */
  countCompletedByAssigneeBetween(consultantId: string, from: Date, to: Date): Promise<number>;

  /**
   * Total overdue count for a single consultant. Filter:
   * `assigned_to = consultantId AND due_date < NOW() AND kanban_status NOT IN
   * (DONE, CANCELLED)`. Soft-deleted rows excluded.
   */
  countOverdueByAssignee(consultantId: string): Promise<number>;

  /**
   * Count of REVISION_REQUESTED rows currently assigned to the consultant.
   * Surface metric for `performance.revisions_requested_count`.
   */
  countRevisionRequestedByAssignee(consultantId: string): Promise<number>;

  /**
   * Top-N overdue rows for the consultant action-items endpoint. Ordered by
   * `due_date` ASC (oldest first — most urgent). Joins to project so the
   * caller renders `project_title` without a second round-trip.
   */
  findOverdueByAssignee(
    consultantId: string,
    limit: number,
  ): Promise<IConsultantTaskActionItemRow[]>;

  /**
   * Top-N caller-owned rows currently `IN_REVIEW` or `PENDING_APPROVAL` —
   * waiting on the business side. Ordered by `updated_at` ASC (oldest first).
   */
  findAwaitingBusinessApprovalByAssignee(
    consultantId: string,
    limit: number,
  ): Promise<IConsultantTaskActionItemRow[]>;

  /**
   * Top-N caller-owned rows in `REVISION_REQUESTED` — these are tasks the
   * business has bounced back for changes. Ordered by `updated_at` DESC
   * (most recent first — the consultant should see the latest revisions).
   */
  findRevisionRequestedByAssignee(
    consultantId: string,
    limit: number,
  ): Promise<IConsultantTaskActionItemRow[]>;

  /**
   * Mean cycle time in days over DONE tasks assigned to this consultant
   * whose `completed_at` falls in the window. `null` when no qualifying rows.
   */
  avgCycleDaysByAssigneeBetween(consultantId: string, from: Date, to: Date): Promise<number | null>;

  /**
   * On-time delivery counters for a single consultant in the window:
   *   `total` = DONE rows in the window with `due_date IS NOT NULL`
   *   `onTime` = subset where `completed_at <= due_date`
   */
  countOnTimeByAssigneeBetween(
    consultantId: string,
    from: Date,
    to: Date,
  ): Promise<{ onTime: number; total: number }>;

  /**
   * Per-(project, status) counts of the caller's assigned tasks across a
   * project universe. `overdue_count` is a sub-count of rows where
   * `due_date < NOW()` (regardless of status). Used by the consultant
   * project-progress endpoint.
   */
  countByAssigneeAndProjectIdsBreakdown(
    consultantId: string,
    projectIds: string[],
  ): Promise<IConsultantProjectTaskBreakdownRow[]>;

  /**
   * Latest `task.updated_at` across the caller's assigned tasks in each
   * project. Powers the `last_activity_at` column in project-progress.
   * Projects with no caller-owned tasks are absent from the result.
   */
  findLatestActivityByAssigneeAndProjectIds(
    consultantId: string,
    projectIds: string[],
  ): Promise<Map<string, Date>>;

  /**
   * Count of DONE tasks where the caller is `assigned_to` and the project
   * lists each given skill as a required skill. Joins through
   * `project_required_skills`. Same multi-skill caveat as
   * {@link IConsultantTransactionRepository.sumClearedEarningsByConsultantAndSkillId}.
   * Skills with zero matches are absent from the map.
   */
  countDoneByAssigneeGroupedBySkill(
    consultantId: string,
    skillIds: string[],
  ): Promise<Map<string, number>>;
}
