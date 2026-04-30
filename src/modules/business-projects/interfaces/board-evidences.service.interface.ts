import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import { BoardEvidenceResponseDto } from '../dto/responses';

/**
 * Read-only listing of consultant-submitted evidences for the BUSINESS
 * surface. Mutations (create/update/delete) live on the consultant-side
 * `TaskEvidencesService` — not exposed here.
 */
export interface IBoardEvidencesService {
  /**
   * Returns paginated evidences for a non-DRAFT task in the caller's
   * project. Each entry includes the consultant author's display fields and
   * the snapshotted attachments persisted at create-time.
   *
   * @param projectId   UUID of the project. Caller must own it.
   * @param taskId      UUID of the task. Must belong to the project and not
   *                    be in DRAFT.
   * @param pageOptions Standard pagination (`page`, `limit`).
   * @returns Page of evidences ordered `created_at DESC`.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND.
   * @throws TranslatableException 404 TASK_NOT_FOUND.
   */
  list(
    projectId: string,
    taskId: string,
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<BoardEvidenceResponseDto>>;
}
