import { PageDto } from '@common/dto/page.dto';

import { AssignConsultantTaskDto } from '../dto/requests/assign-consultant-task.dto';
import { ListConsultantProjectTasksDto } from '../dto/requests/list-consultant-project-tasks.dto';
import {
  ConsultantProjectTaskListItemResponseDto,
  ConsultantTaskSummaryResponseDto,
} from '../dto/responses';

/**
 * Consultant-side task management inside a joined project. Owns the
 * transactional writes (assign / unassign / submit-for-review) plus the task
 * list endpoint. Every method requires the caller to have an ACTIVE
 * `ProjectMember` row on the target project.
 */
export interface IConsultantProjectTasksService {
  /**
   * Paginated task list scoped to a single project. Visibility is
   * (unassigned TO_DO) ∪ (caller-owned, non-DRAFT). Ordered with IN_PROGRESS
   * first, then TO_DO, then the rest. Cached 60s per (consultant, project,
   * page, limit, keyword).
   *
   * @param projectId UUID of the project.
   * @param dto Pagination + optional keyword on title or code.
   * @throws TranslatableException 403 CONSULTANT_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when not an active member.
   */
  listTasks(
    projectId: string,
    dto: ListConsultantProjectTasksDto,
  ): Promise<PageDto<ConsultantProjectTaskListItemResponseDto>>;

  /**
   * Self-claim a TO_DO task. Sets `assigned_to`, `assigned_at`, `due_date`,
   * `kanban_status = IN_PROGRESS`, and `started_at` (only when null —
   * preserves total-worked semantics across revisions). Race-safe via
   * `FOR UPDATE SKIP LOCKED` — concurrent claims see `null` and the loser
   * receives `TASK_NOT_CLAIMABLE`. After commit emits
   * `NOTIFICATION_EVENTS.TASK_STATUS_CHANGED` so the business owner is
   * notified.
   *
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when not an active member.
   * @throws TranslatableException 409 TASK_NOT_CLAIMABLE when status ≠ TO_DO or already assigned.
   * @throws TranslatableException 422 TASK_DUE_DATE_INVALID (validation layer).
   */
  assignTask(
    projectId: string,
    taskId: string,
    dto: AssignConsultantTaskDto,
  ): Promise<ConsultantTaskSummaryResponseDto>;

  /**
   * Release an IN_PROGRESS task owned by the caller. Clears `assigned_to`,
   * `assigned_at`, and `due_date`; flips status back to TO_DO. `started_at`
   * is intentionally preserved so re-claims continue to measure total worked
   * time across the whole lifecycle.
   *
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when not an active member.
   * @throws TranslatableException 404 TASK_NOT_FOUND when the task is missing.
   * @throws TranslatableException 403 TASK_NOT_OWNED_BY_CONSULTANT when assigned to someone else.
   * @throws TranslatableException 409 TASK_INVALID_STATE_FOR_UNASSIGN when status ≠ IN_PROGRESS.
   */
  unassignTask(projectId: string, taskId: string): Promise<ConsultantTaskSummaryResponseDto>;

  /**
   * Submit a caller-owned IN_PROGRESS task for the business owner to review.
   * Flips status to IN_REVIEW; leaves all timestamps untouched. Emits the
   * status-changed event so the business owner gets notified.
   *
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when not an active member.
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   * @throws TranslatableException 403 TASK_NOT_OWNED_BY_CONSULTANT.
   * @throws TranslatableException 409 TASK_INVALID_STATE_FOR_SUBMIT when status ≠ IN_PROGRESS.
   */
  submitForReview(projectId: string, taskId: string): Promise<ConsultantTaskSummaryResponseDto>;
}
