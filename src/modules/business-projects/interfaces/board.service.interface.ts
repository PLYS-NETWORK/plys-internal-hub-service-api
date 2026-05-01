import { AssignTaskDto, ChangeTaskStatusesDto, ReorderTasksDto } from '../dto/requests';
import { BoardTaskDetailResponseDto, BoardTaskResponseDto } from '../dto/responses';

/**
 * Kanban board surface — every task except DRAFT. Drafts live on the Backlogs
 * controller; movement between the two is mediated by `pay-tasks`.
 */
export interface IBoardService {
  /** All non-draft tasks for the project, ordered by display_order ASC. */
  listTasks(projectId: string): Promise<BoardTaskResponseDto[]>;

  /**
   * Reorders tasks within a single column. Every task in the payload must
   * already be in `dto.currentStatus`; this endpoint never moves tasks
   * between columns. Position updates are written in batches of 50 inside
   * one transaction with the project row pessimistically locked.
   *
   * @param projectId The owning project (must be owned by the calling business).
   * @param dto       The current column and per-task `display_order` values.
   * @throws TranslatableException 422 TASK_INVALID_STATUS_TRANSITION when
   *   `currentStatus` is DRAFT/DONE/CANCELLED, when the payload contains
   *   duplicate `display_order` values, or when any referenced task is not
   *   currently in `currentStatus`.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project is
   *   not owned by the calling business.
   */
  reorderTasks(projectId: string, dto: ReorderTasksDto): Promise<void>;

  /**
   * Moves tasks between columns. Each task lands at the **end** of its
   * destination column in payload order. DRAFT/DONE/CANCELLED are owned by
   * other flows (backlog payment, approval, cancellation) and rejected
   * here in either direction.
   *
   * @param projectId The owning project.
   * @param dto       Per-task target `kanban_status` values.
   * @throws TranslatableException 422 TASK_INVALID_STATUS_TRANSITION when
   *   any source or target status is in {DRAFT, DONE, CANCELLED}, or when a
   *   task is already in its requested target status (no-op move).
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project is
   *   not owned by the calling business.
   */
  changeTaskStatuses(projectId: string, dto: ChangeTaskStatusesDto): Promise<void>;

  /** Full task detail (counts only — comment/evidence bodies on existing endpoints). */
  getTaskDetail(projectId: string, taskId: string): Promise<BoardTaskDetailResponseDto>;

  /**
   * Assigns a consultant who is an ACTIVE project member. Auto-transitions
   * `TO_DO → ASSIGNED`. Rejects on DRAFT or CANCELLED tasks.
   * @throws TranslatableException 422 TASK_CONSULTANT_NOT_PROJECT_MEMBER.
   * @throws TranslatableException 422 TASK_INVALID_STATUS_TRANSITION.
   */
  assign(projectId: string, taskId: string, dto: AssignTaskDto): Promise<void>;

  /**
   * Removes the assignment. Auto-transitions `ASSIGNED → TO_DO`; rejects with
   * `TASK_INVALID_STATUS_TRANSITION` if the task is past ASSIGNED so the
   * business cannot silently lose progress on an in-flight task.
   */
  unassign(projectId: string, taskId: string): Promise<void>;
}
