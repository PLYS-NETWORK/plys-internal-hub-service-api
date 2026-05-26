import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PageOptionsDto } from '@plys/libraries/common-nest/dto/page-options.dto';

import { BoardResultResponseDto } from '../dto/responses';

/**
 * Read-only listing of consultant-submitted task results for the BUSINESS
 * surface. Mutations (create/update/delete) live on the consultant-side
 * `ConsultantBoardResultsService` — not exposed here.
 */
export interface IBoardResultsService {
  /**
   * Returns paginated results for a non-DRAFT task in the caller's project.
   * Each entry includes the consultant author's display fields and the
   * attachments snapshotted at create-time.
   *
   * @param projectId   UUID of the project. Caller must own it.
   * @param taskId      UUID of the task. Must belong to the project and not
   *                    be in DRAFT.
   * @param pageOptions Standard pagination (`page`, `limit`).
   * @returns Page of results ordered `created_at DESC`.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   */
  list(
    projectId: string,
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<BoardResultResponseDto>>;
}
