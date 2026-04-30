import { AssignTaskDto, UpdateTaskPositionsDto } from '../dto/requests';
import { BoardTaskDetailResponseDto, BoardTaskResponseDto } from '../dto/responses';

/**
 * Kanban board surface — every task except DRAFT. Drafts live on the Backlogs
 * controller; movement between the two is mediated by `pay-tasks`.
 */
export interface IBoardService {
  /** All non-draft tasks for the project, ordered by display_order ASC. */
  listTasks(projectId: string): Promise<BoardTaskResponseDto[]>;

  /**
   * Bulk position write after a kanban drag. All-or-nothing under a single
   * transaction. Each id must belong to this project and be non-DRAFT.
   * @throws TranslatableException 422 TASK_INVALID_STATUS_TRANSITION.
   */
  updatePositions(projectId: string, dto: UpdateTaskPositionsDto): Promise<void>;

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
