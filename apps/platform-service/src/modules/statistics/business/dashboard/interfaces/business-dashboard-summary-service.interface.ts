import { BusinessDashboardSummaryResponseDto } from '../../../dto/responses/business-dashboard-summary-response.dto';

/**
 * Contract for the batched business-dashboard summary. One request paints
 * the landing screen — money, portfolio, throughput, team, action counts.
 */
export interface IBusinessDashboardSummaryService {
  /**
   * Builds the snapshot from the caller's `RequestContextService.userId`.
   * Resolves the business profile (or throws `BUSINESS_PROFILE_NOT_FOUND`),
   * fans out the sub-aggregates in parallel, computes derived deltas, and
   * caches the result for 60 s under a per-business key.
   * @returns Populated summary DTO with `generated_at` stamped at compute time.
   * @throws TranslatableException (403) — `BUSINESS_PROFILE_NOT_FOUND` when the
   *         caller has no business profile (admin / consultant).
   */
  get(): Promise<BusinessDashboardSummaryResponseDto>;
}
