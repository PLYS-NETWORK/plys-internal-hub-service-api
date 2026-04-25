import { TaskKanbanStatus } from '@database/enums';

/**
 * Allowed kanban status transitions when initiated by a consultant.
 *
 * Key = current status, value = list of permitted target statuses.
 *
 * Notes:
 * - `to_do → in_progress` triggers auto-assignment of the calling consultant.
 * - `in_progress → to_do` triggers auto-unassignment (caller must be the assignee).
 * - `done` is intentionally not a key — once a task is done, the consultant cannot move it.
 */
export const CONSULTANT_TRANSITIONS: ReadonlyMap<TaskKanbanStatus, readonly TaskKanbanStatus[]> =
  new Map<TaskKanbanStatus, TaskKanbanStatus[]>([
    [TaskKanbanStatus.TO_DO, [TaskKanbanStatus.IN_PROGRESS]],
    [TaskKanbanStatus.ASSIGNED, [TaskKanbanStatus.IN_PROGRESS]],
    [TaskKanbanStatus.IN_PROGRESS, [TaskKanbanStatus.IN_REVIEW, TaskKanbanStatus.TO_DO]],
    [TaskKanbanStatus.IN_REVIEW, [TaskKanbanStatus.IN_PROGRESS]],
    [TaskKanbanStatus.REVISION_REQUESTED, [TaskKanbanStatus.IN_PROGRESS]],
  ]);

/**
 * Targets a business is forbidden from setting via `updateBusinessStatus`.
 * The business may move a task into any other status — payment gates handle
 * the side effects for `draft → to_do` and `→ done`.
 */
export const BUSINESS_FORBIDDEN_TARGETS: ReadonlySet<TaskKanbanStatus> = new Set<TaskKanbanStatus>([
  TaskKanbanStatus.DRAFT,
]);
