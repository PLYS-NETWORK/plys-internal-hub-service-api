import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import {
  AssignTaskDto,
  CreateTaskDto,
  ReorderTasksDto,
  UpdateTaskBusinessStatusDto,
  UpdateTaskConsultantStatusDto,
} from '../dto/requests';
import { ConsultantTaskResponseDto, TaskResponseDto } from '../dto/responses';

/**
 * Contract for all task operation actions available to business users and consultants.
 *
 * Caller identity is resolved internally via `RequestContextService` — no
 * `userId` or profile ID is accepted as a parameter on any method.
 */
export interface ITaskOperationsService {
  /**
   * Creates a new task in `draft` status inside a project that is currently
   * `in_progress`. Only the business that owns the project may call this.
   *
   * @param dto - Validated create payload (title, price, difficultyLevel required;
   *              description is optional).
   * @returns The newly created task DTO with `kanban_status: draft`.
   * @throws TranslatableException (404) — project not found or not owned by caller.
   * @throws TranslatableException (422) — project is not in `in_progress` status.
   */
  createDraftTask(dto: CreateTaskDto): Promise<TaskResponseDto>;

  /**
   * Transitions a task to a new kanban status on behalf of the business.
   *
   * Handles two special payment gates automatically:
   * - `draft → to_do`: deducts `task.price` from the business balance (pre-paid businesses only).
   * - `any → done`: credits `task.consultantPayout` to the assigned consultant
   *   (immediate for pre-paid; pending for credit-based businesses).
   *
   * @param taskId - UUID of the task to update.
   * @param dto    - Contains the target `status` value.
   * @returns The updated task DTO reflecting the new status.
   * @throws TranslatableException (404) — task not found or not owned by calling business.
   * @throws TranslatableException (422) — status transition is not permitted.
   * @throws TranslatableException (422) — insufficient account balance (pre-paid, draft→to_do).
   */
  updateBusinessStatus(taskId: string, dto: UpdateTaskBusinessStatusDto): Promise<TaskResponseDto>;

  /**
   * Transitions a task status on behalf of the assigned consultant, using the
   * restricted `CONSULTANT_TRANSITIONS` map. The caller must be the consultant
   * currently assigned to the task.
   *
   * @param taskId - UUID of the task to update.
   * @param dto    - Contains the target `status` value.
   * @returns The updated task DTO reflecting the new status.
   * @throws TranslatableException (404) — task not found.
   * @throws TranslatableException (403) — caller is not the assigned consultant.
   * @throws TranslatableException (422) — transition not allowed from the current status.
   */
  updateConsultantStatus(
    taskId: string,
    dto: UpdateTaskConsultantStatusDto,
  ): Promise<TaskResponseDto>;

  /**
   * Allows a consultant to self-assign to an unassigned `to_do` task.
   *
   * Uses `SELECT FOR UPDATE SKIP LOCKED` (pessimistic write) to prevent two
   * consultants from claiming the same task simultaneously. The consultant must
   * be an `ACTIVE` member of the task's project.
   *
   * @param taskId - UUID of the task to claim.
   * @returns The updated task DTO with `kanban_status: assigned` and the caller set as `assigned_to`.
   * @throws TranslatableException (409) — task is already assigned or no longer in `to_do`.
   * @throws TranslatableException (422) — caller is not an active project member.
   */
  claimTask(taskId: string): Promise<TaskResponseDto>;

  /**
   * Allows the project-owning business to manually assign a specific consultant
   * to a `to_do` task that has no current assignee.
   *
   * The target consultant must be an `ACTIVE` member of the task's project.
   *
   * @param taskId - UUID of the task to assign.
   * @param dto    - Contains `consultantId` — the UUID of the consultant to assign.
   * @returns The updated task DTO with `kanban_status: assigned`.
   * @throws TranslatableException (404) — task not found or not owned by calling business.
   * @throws TranslatableException (409) — task is already assigned or not in `to_do` status.
   * @throws TranslatableException (422) — target consultant is not an active project member.
   */
  assignTask(taskId: string, dto: AssignTaskDto): Promise<TaskResponseDto>;

  /**
   * Returns a paginated list of all tasks belonging to a project, ordered by
   * `display_order` ascending. No ownership check is performed — the caller
   * supplies the project ID directly.
   *
   * @param projectId   - UUID of the project whose tasks to list.
   * @param pageOptions - Pagination parameters (page, take).
   * @returns Paginated wrapper containing task DTOs and page metadata.
   */
  listProjectTasks(
    projectId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<TaskResponseDto>>;

  /**
   * Bulk-updates the `display_order` field for a set of tasks owned by the
   * calling business. All task IDs in the payload must belong to projects owned
   * by the caller; any mismatch causes the entire operation to abort.
   *
   * @param dto - Contains an array of `{ id, displayOrder }` objects.
   * @throws TranslatableException (404) — one or more task IDs not found or not owned by caller.
   */
  reorderTasks(dto: ReorderTasksDto): Promise<void>;

  /**
   * Returns a paginated list of tasks for a project, scoped to the consultant
   * platform. The caller must be an `ACTIVE` member of the project.
   *
   * Returns `ConsultantTaskResponseDto` which omits sensitive pricing fields
   * (`price`, `platform_fee_amount`, `consultant_payout`) visible only to business.
   *
   * @param projectId   - UUID of the project whose tasks to list.
   * @param pageOptions - Pagination parameters (page, take).
   * @returns Paginated wrapper containing consultant-scoped task DTOs and page metadata.
   * @throws TranslatableException (422) — caller is not an active project member.
   */
  listProjectTasksForConsultant(
    projectId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<ConsultantTaskResponseDto>>;
}
