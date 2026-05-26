import { AdminGrowthTrendDto } from '../../dto/requests/admin-growth-trend.dto';
import { AdminGrowthTrendResponseDto } from '../../dto/responses/admin-growth-trend-response.dto';

/**
 * Contract for the growth-trend chart endpoint. Aligns four metric series
 * (new consultants, new businesses, GMV, payouts) onto the same time-bucket
 * axis so the FE only has to render one X axis.
 */
export interface IAdminGrowthTrendService {
  /**
   * Builds the aligned trend series.
   * @param dto Query window + bucket granularity. When `from`/`to` are omitted,
   *            defaults to the last 6 calendar months ending at "now".
   * @returns Time-aligned points; `granularity` is echoed back for client convenience.
   */
  get(dto: AdminGrowthTrendDto): Promise<AdminGrowthTrendResponseDto>;
}
