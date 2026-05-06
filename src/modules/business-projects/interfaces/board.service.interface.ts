import { PageDto } from '@common/dto/page.dto';

import { ListBoardTasksDto } from '../dto/requests';
import { BoardTaskDetailResponseDto, BoardTaskResponseDto } from '../dto/responses';

/**
 * Kanban board surface — every task except DRAFT. Drafts live on the Backlogs
 * controller; movement between the two is mediated by `pay-tasks`.
 */
export interface IBoardService {
  /**
   * Returns the project's tasks (excluding DRAFT) with optional filters and
   * sort, formatted for the business board view.
   *
   * The response is cached per (projectId, userId, timezone, filter-set) for
   * a short TTL. Pass `is_remove_cache=true` to skip and refresh the cache.
   *
   * @param projectId Project owned by the calling business.
   * @param filters   Optional kanban-status / assignee filter and sort.
   * @returns Paginated tasks with assignee, attachments_count, total_time_worked,
   *   created_day and last_update formatted in the caller's timezone.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project is
   *   not owned by the calling business.
   */
  listTasks(projectId: string, filters: ListBoardTasksDto): Promise<PageDto<BoardTaskResponseDto>>;

  /**
   * Full task detail including attachments. DRAFT tasks are surfaced as 404.
   *
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   */
  getTaskDetail(projectId: string, taskId: string): Promise<BoardTaskDetailResponseDto>;
}
