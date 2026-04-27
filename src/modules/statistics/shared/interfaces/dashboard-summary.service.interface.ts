import { DashboardSummaryResponseDto } from '../../dto/responses/dashboard-summary-response.dto';

export interface IDashboardSummaryService {
  /**
   * Single batched payload for the four dashboard KPI cards (projects, tasks,
   * applications, billing). Recommended as the first call on dashboard load
   * — short-TTL cacheable.
   *
   * @returns The KPI summary plus a `generated_at` timestamp.
   */
  get(): Promise<DashboardSummaryResponseDto>;
}
