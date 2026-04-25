import { UpdateTaskConsultantStatusDto } from '../../dto/requests';
import { ConsultantTaskResponseDto, TaskResponseDto } from '../../dto/responses';

/**
 * Consultant-platform task operations.
 *
 * Caller identity is resolved internally via `RequestContextService` — no
 * `userId` is accepted as a parameter on any method.
 */
export interface IConsultantTasksService {
  /**
   * Lists all non-draft tasks for a project the consultant is an active member
   * of, ordered by `display_order` ascending.
   *
   * @throws TranslatableException (422) — caller is not an active project member.
   */
  listProjectTasks(projectId: string): Promise<ConsultantTaskResponseDto[]>;

  /**
   * Transitions a task status on behalf of the consultant. Delegates to
   * `ConsultantTaskStatusStrategy` which handles auto-assign / auto-unassign
   * and the one-task-in-progress constraint.
   *
   * @throws TranslatableException (404) — task not found.
   * @throws TranslatableException (403) — caller is not the assignee (non-claim paths).
   * @throws TranslatableException (409) — consultant already has another task in progress.
   * @throws TranslatableException (422) — invalid transition or not a project member.
   */
  updateStatus(taskId: string, dto: UpdateTaskConsultantStatusDto): Promise<TaskResponseDto>;
}
