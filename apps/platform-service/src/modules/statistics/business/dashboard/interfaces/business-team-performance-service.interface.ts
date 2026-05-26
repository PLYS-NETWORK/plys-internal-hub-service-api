import { BusinessTeamPerformanceDto } from '../../../dto/requests/business-team-performance.dto';
import { BusinessTeamPerformanceResponseDto } from '../../../dto/responses/business-team-performance-response.dto';

/**
 * Per-consultant performance table across the owner's projects. Only
 * consultants currently ACTIVE on at least one of the owner's projects are
 * listed.
 */
export interface IBusinessTeamPerformanceService {
  /**
   * @param dto Window + sort + limit. Defaults to MTD, `completed_tasks_desc`, 20.
   * @throws TranslatableException (403) — `BUSINESS_PROFILE_NOT_FOUND`.
   */
  get(dto: BusinessTeamPerformanceDto): Promise<BusinessTeamPerformanceResponseDto>;
}
