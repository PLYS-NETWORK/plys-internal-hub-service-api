import { AdminDashboardSummaryResponseDto } from '../../dto/responses/admin-dashboard-summary-response.dto';

/**
 * Contract for the batched admin dashboard summary. Single read endpoint
 * powering the four KPI cards (users, financial, queues, growth).
 */
export interface IAdminDashboardSummaryService {
  /**
   * Builds the platform-wide KPI snapshot. Sub-aggregates run in parallel;
   * the result is cached for {@link AdminDashboardCacheTtl.SUMMARY} seconds.
   * @returns Populated summary DTO with `generated_at` set to the live request time.
   */
  get(): Promise<AdminDashboardSummaryResponseDto>;
}
