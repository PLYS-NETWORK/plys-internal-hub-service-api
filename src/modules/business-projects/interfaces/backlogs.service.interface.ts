import { PageDto } from '@common/dto/page.dto';

import {
  CreateDraftTaskDto,
  ListDraftTasksDto,
  TaskIdsDto,
  UpdateDraftTaskDto,
} from '../dto/requests';
import {
  AddToBoardValidationResponseDto,
  DraftTaskResponseDto,
  PayTasksResponseDto,
} from '../dto/responses';

/**
 * Backlog of draft tasks for a project. Drafts are not visible on the kanban
 * board; they need to go through `addToBoardValidation` + `payTasks` to be
 * promoted (and charged for) into the TO_DO column.
 */
export interface IBacklogsService {
  /**
   * Creates a single draft task. Server forces `kanban_status = DRAFT` and
   * `creation_mode = MANUAL`; `display_order` defaults to (max DRAFT order in
   * this project) + 1.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   */
  createDraftTask(projectId: string, dto: CreateDraftTaskDto): Promise<DraftTaskResponseDto>;

  /** Paginated list of DRAFT tasks for the project, optional title keyword. */
  listDraftTasks(projectId: string, dto: ListDraftTasksDto): Promise<PageDto<DraftTaskResponseDto>>;

  /**
   * Hard-deletes one or more DRAFT tasks. Atomic — if any supplied id is not
   * DRAFT or not on this project, the whole call rejects.
   * @throws TranslatableException 422 TASK_INVALID_STATUS_TRANSITION.
   */
  bulkDelete(projectId: string, dto: TaskIdsDto): Promise<void>;

  /**
   * Read-only validation for moving the supplied DRAFT tasks to the board.
   * Mirrors `validatePublish`: computes commission + total + paymentType but
   * does NOT change state or charge anything. The pay endpoint must re-run
   * the same validation under a row lock before debiting.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 422 PROJECT_INVALID_STATUS_TRANSITION when
   *   the project is not PUBLISHED or IN_PROGRESS.
   */
  addToBoardValidation(
    projectId: string,
    dto: TaskIdsDto,
  ): Promise<AddToBoardValidationResponseDto>;

  /**
   * Atomically charges the business and moves the supplied DRAFT tasks to
   * TO_DO. Pre-paid: lock business profile, debit balance, insert COMPLETED
   * BusinessTransaction. Credit: insert PENDING BusinessTransaction without
   * a balance debit. The validation block runs again inside the lock.
   * @throws TranslatableException 422 PROJECT_INSUFFICIENT_BALANCE
   *   (pre-paid only, locked re-check).
   * @throws TranslatableException 422 PROJECT_INVALID_STATUS_TRANSITION
   *   (project status changed between validation and pay).
   */
  payTasks(projectId: string, dto: TaskIdsDto): Promise<PayTasksResponseDto>;

  /**
   * Partially updates a DRAFT task's title, description, or price.
   * @throws TranslatableException 404 TASK_NOT_FOUND if the task is missing or not DRAFT.
   */
  updateDraftTask(
    projectId: string,
    taskId: string,
    dto: UpdateDraftTaskDto,
  ): Promise<DraftTaskResponseDto>;

  /**
   * Returns a single DRAFT task with its full attachments array.
   * @throws TranslatableException 404 TASK_NOT_FOUND if missing or not DRAFT.
   */
  getTaskDetail(projectId: string, taskId: string): Promise<DraftTaskResponseDto>;
}
