import { BusinessSpendTrendDto } from '../../../dto/requests/business-spend-trend.dto';
import { BusinessSpendTrendResponseDto } from '../../../dto/responses/business-spend-trend-response.dto';

/**
 * Time-series of business outflow (TOP_UP + MONTHLY_BILLING + PROJECT_PUBLISHED +
 * TASK_ADDED, all in `COMPLETED` status). Buckets ascend chronologically, each
 * carrying the bucket spend plus the running cumulative.
 */
export interface IBusinessSpendTrendService {
  /**
   * @param dto Query window + bucket granularity. Defaults to last 6 calendar
   *            months ending now, monthly granularity.
   * @throws TranslatableException (403) — `BUSINESS_PROFILE_NOT_FOUND`.
   */
  get(dto: BusinessSpendTrendDto): Promise<BusinessSpendTrendResponseDto>;
}
