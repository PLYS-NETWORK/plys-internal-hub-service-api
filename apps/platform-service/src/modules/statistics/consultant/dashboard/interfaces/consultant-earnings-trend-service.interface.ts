import { ConsultantEarningsTrendDto } from '../../../dto/requests/consultant-earnings-trend.dto';
import { ConsultantEarningsTrendResponseDto } from '../../../dto/responses/consultant-earnings-trend-response.dto';

/**
 * Time-series of consultant earnings (CREDIT_CLEARED), pending accruals
 * (CREDIT_PENDING) and withdrawals (WITHDRAWAL). Bucketed by month or week,
 * each carrying the bucket totals plus the running cumulative earned.
 */
export interface IConsultantEarningsTrendService {
  /**
   * @param dto Query window + bucket granularity. Defaults to last 6 calendar
   *            months ending now, monthly granularity.
   * @throws TranslatableException (403) — `CONSULTANT_PROFILE_NOT_FOUND`.
   */
  get(dto: ConsultantEarningsTrendDto): Promise<ConsultantEarningsTrendResponseDto>;
}
