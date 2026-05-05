import { ReorderTasksDto } from '../dto/requests';
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

  /** Full task detail (evidence bodies live on the dedicated endpoint). */
  getTaskDetail(projectId: string, taskId: string): Promise<BoardTaskDetailResponseDto>;
}
