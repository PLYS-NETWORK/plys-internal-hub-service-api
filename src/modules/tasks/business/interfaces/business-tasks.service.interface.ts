import {
  AssignTaskDto,
  CreateTaskDto,
  ReorderTasksDto,
  UpdateTaskBusinessStatusDto,
} from '../../dto/requests';
import { TaskResponseDto } from '../../dto/responses';

/**
 * Business-platform task operations.
 *
 * Caller identity is resolved internally via `RequestContextService` — no
 * `userId` is accepted as a parameter on any method.
 */
export interface IBusinessTasksService {
  /**
   * Creates a new task in `draft` status inside an `in_progress` project owned
   * by the calling business.
   *
   * @returns The newly created task DTO with `kanban_status: draft`.
   * @throws TranslatableException (404) — project not found or not owned.
   * @throws TranslatableException (422) — project is not in `in_progress` status.
   */
  createDraftTask(dto: CreateTaskDto): Promise<TaskResponseDto>;

  /**
   * Transitions a task to a new kanban status on behalf of the business.
   * Delegates to `BusinessTaskStatusStrategy` which handles payment gates.
   *
   * @throws TranslatableException (404) — task not found / not owned.
   * @throws TranslatableException (422) — invalid transition or insufficient balance.
   */
  updateStatus(taskId: string, dto: UpdateTaskBusinessStatusDto): Promise<TaskResponseDto>;

  /**
   * Manually assigns a specific consultant to a `to_do` task with no current
   * assignee. The target consultant must be an ACTIVE project member.
   *
   * @throws TranslatableException (404) — task not found / not owned.
   * @throws TranslatableException (409) — task already assigned or not in `to_do`.
   * @throws TranslatableException (422) — consultant is not an active project member.
   */
  assignTask(taskId: string, dto: AssignTaskDto): Promise<TaskResponseDto>;

  /**
   * Bulk-updates `display_order` for a set of tasks owned by the caller.
   * @throws TranslatableException (404) — one or more tasks not found / not owned.
   */
  reorderTasks(dto: ReorderTasksDto): Promise<void>;

  /**
   * Returns all non-draft tasks for a project (kanban board), ordered by
   * `display_order` ascending. Caller must own the project.
   * @throws TranslatableException (404) — project not found / not owned.
   */
  listKanbanTasks(projectId: string): Promise<TaskResponseDto[]>;

  /**
   * Returns all draft tasks for a project, ordered by `display_order` ascending.
   * Caller must own the project.
   * @throws TranslatableException (404) — project not found / not owned.
   */
  listDraftTasks(projectId: string): Promise<TaskResponseDto[]>;
}
