import { ChangeTaskStatusDto } from '../dto/requests';
import { ConsultantBoardTaskResponseDto } from '../dto/responses';

export interface IConsultantBoardService {
  /**
   * Lists the kanban board for an active member. Excludes DRAFT (which lives
   * in the business-side backlog). Each row carries the assignee snapshot
   * plus live comment / evidence counts.
   *
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 403 PROJECT_FORBIDDEN.
   */
  listTasks(projectId: string): Promise<ConsultantBoardTaskResponseDto[]>;

  /**
   * Atomically claims an unassigned TO_DO task. TO_DO → ASSIGNED.
   *
   * @throws TranslatableException 422 TASK_INVALID_STATUS_TRANSITION when the
   *         task is missing, in another status, or already assigned.
   */
  assignSelf(projectId: string, taskId: string): Promise<void>;

  /**
   * Releases the consultant's assignment if and only if the task is still
   * in ASSIGNED status (no work has started). ASSIGNED → TO_DO.
   *
   * @throws TranslatableException 422 TASK_INVALID_STATUS_TRANSITION.
   */
  unassignSelf(projectId: string, taskId: string): Promise<void>;

  /**
   * Transitions the consultant's task between board statuses. Allowed
   * transitions are restricted to (ASSIGNED→IN_PROGRESS,
   * IN_PROGRESS→IN_REVIEW, IN_REVIEW→IN_PROGRESS); DONE/CANCELLED are
   * business-only.
   *
   * @throws TranslatableException 422 TASK_INVALID_STATUS_TRANSITION.
   * @throws TranslatableException 409 TASK_CONSULTANT_ALREADY_IN_PROGRESS
   *         when the consultant already has another task in IN_PROGRESS and
   *         the target is IN_PROGRESS.
   */
  changeStatus(projectId: string, taskId: string, dto: ChangeTaskStatusDto): Promise<void>;
}
