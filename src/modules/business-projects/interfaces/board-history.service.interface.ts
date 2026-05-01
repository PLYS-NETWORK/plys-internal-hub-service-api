import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import { BoardTaskHistoryResponseDto } from '../dto/responses';

/**
 * Read-only feed of `task_history` rows for the BUSINESS surface. Rows are
 * append-only and populated by the `trg_log_task_change` DB trigger — this
 * service never writes them.
 */
export interface IBoardHistoryService {
  /**
   * Returns the paginated history of status changes and (un)assignments for a
   * non-DRAFT task in the caller's project. Author display fields are
   * resolved in a single SQL: consultant `full_name` + `avatar_url` is
   * preferred; falls back to business `company_name` + `logo_url`; falls back
   * to `users.email` when no profile exists; finally `"System"` when
   * `changed_by IS NULL` (DB-trigger-only events).
   *
   * @param projectId   UUID of the project. Caller must own it.
   * @param taskId      UUID of the task. Must belong to the project and not
   *                    be in DRAFT.
   * @param pageOptions Standard pagination (`page`, `limit`).
   * @returns Page of history entries ordered `changed_at DESC`.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   */
  list(
    projectId: string,
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<BoardTaskHistoryResponseDto>>;
}
