import { BusinessProjectHealthDto } from '../../../dto/requests/business-project-health.dto';
import { BusinessProjectHealthResponseDto } from '../../../dto/responses/business-project-health-response.dto';

/**
 * Per-project health table. Defaults to the active set (PUBLISHED +
 * IN_PROGRESS). Sorted with at-risk projects first; ties broken by
 * `last_activity_at`.
 */
export interface IBusinessProjectHealthService {
  /**
   * @param dto Status filter + limit.
   * @throws TranslatableException (403) — `BUSINESS_PROFILE_NOT_FOUND`.
   */
  get(dto: BusinessProjectHealthDto): Promise<BusinessProjectHealthResponseDto>;
}
