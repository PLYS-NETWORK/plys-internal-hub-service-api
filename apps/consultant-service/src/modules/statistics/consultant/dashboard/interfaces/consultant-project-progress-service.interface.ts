import { ConsultantProjectProgressDto } from '../../../dto/requests/consultant-project-progress.dto';
import { ConsultantProjectProgressResponseDto } from '../../../dto/responses/consultant-project-progress-response.dto';

/**
 * Per-project progress table for the caller's active engagements. Powered by
 * `project_members` (ACTIVE) joined to per-row task aggregates and
 * cleared-earnings per project. Sorted at-risk first.
 */
export interface IConsultantProjectProgressService {
  /**
   * @param dto Optional status filter + page-size limit.
   * @throws TranslatableException (403) — `CONSULTANT_PROFILE_NOT_FOUND`.
   */
  get(dto: ConsultantProjectProgressDto): Promise<ConsultantProjectProgressResponseDto>;
}
