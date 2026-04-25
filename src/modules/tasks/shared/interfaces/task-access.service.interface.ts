import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { Task } from '@database/entities';

import { TaskHistoryResponseDto } from '../../dto/responses';

/**
 * Profile-resolution and project-membership snapshot used by status-transition
 * payment flows. Narrowed to the fields actually consumed by the payment service
 * to keep callers decoupled from the full entity shape.
 */
export interface IBusinessProfileSnapshot {
  id: string;
  allowPaymentCredit: boolean;
  accountBalance: string;
}

export interface IConsultantProfileSnapshot {
  id: string;
}

/**
 * Shared access-control + load helpers for the tasks module.
 *
 * Responsibilities:
 * - Resolve the calling user's business / consultant profile via `RequestContextService`.
 * - Load tasks with ownership / membership guards applied.
 * - Provide consistent `TranslatableException` factories so every "not found"
 *   path reports the same `errorCode` + `messageKey`.
 *
 * Does NOT contain business logic (status transitions, payment, etc.) — those
 * live in dedicated services / strategies.
 */
export interface ITaskAccessService {
  /**
   * Resolves the calling user's business profile id.
   * @returns The `id` of the business profile linked to the current `requestContext.userId`.
   * @throws TranslatableException (403) — caller has no business profile.
   */
  resolveBusinessId(): Promise<string>;

  /**
   * Resolves the calling user's business profile (narrow snapshot).
   * @returns Snapshot containing fields needed by payment flows.
   * @throws TranslatableException (403) — caller has no business profile.
   */
  resolveBusinessProfile(): Promise<IBusinessProfileSnapshot>;

  /**
   * Resolves the calling user's consultant profile (narrow snapshot).
   * @returns Snapshot containing the consultant profile id.
   * @throws TranslatableException (403) — caller has no consultant profile.
   */
  resolveConsultantProfile(): Promise<IConsultantProfileSnapshot>;

  /**
   * Loads a task and verifies its project belongs to `businessId`.
   * @param taskId     - UUID of the task.
   * @param businessId - UUID of the business that must own the parent project.
   * @returns The task with its `project` relation populated.
   * @throws TranslatableException (404) — task missing or not owned.
   */
  findTaskOwnedByBusiness(taskId: string, businessId: string): Promise<Task>;

  /**
   * Loads a task by id; throws 404 if not found.
   * @param taskId - UUID of the task to load.
   * @throws TranslatableException (404) — task not found.
   */
  findTaskOrThrow(taskId: string): Promise<Task>;

  /**
   * Verifies that the consultant is an ACTIVE member of the project.
   * @throws TranslatableException (422) — caller is not an active project member.
   */
  verifyProjectMembership(projectId: string, consultantId: string): Promise<void>;

  /**
   * Returns paginated history records for a task ordered by `changed_at` DESC,
   * filtered to STATUS_CHANGE / ASSIGNMENT / UNASSIGNMENT change types.
   * @throws TranslatableException (404) — task not found.
   */
  getTaskHistory(
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<TaskHistoryResponseDto>>;

  /**
   * Factory: produces the canonical "task not found" exception (404) and writes
   * a warn-level log entry so the call site doesn't have to.
   */
  taskNotFound(taskId: string): TranslatableException;

  /**
   * Factory: produces the canonical "project not found / not owned" exception (404).
   */
  projectNotFound(projectId: string, businessId: string): TranslatableException;
}
