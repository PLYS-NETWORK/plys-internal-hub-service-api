import { ConsultantDashboardSummaryResponseDto } from '../../../dto/responses/consultant-dashboard-summary-response.dto';

/**
 * Contract for the batched consultant-dashboard summary. One request paints
 * the landing screen — money, portfolio, performance, skills, exams,
 * onboarding, action counts.
 */
export interface IConsultantDashboardSummaryService {
  /**
   * Builds the snapshot from the caller's `RequestContextService.userId`.
   * Resolves the consultant profile (or throws `CONSULTANT_PROFILE_NOT_FOUND`),
   * fans out the sub-aggregates in parallel, computes derived deltas, and
   * caches the result for 60 s under a per-consultant key.
   * @returns Populated summary DTO with `generated_at` stamped at compute time.
   * @throws TranslatableException (403) — `CONSULTANT_PROFILE_NOT_FOUND` when
   *         the caller has no consultant profile (e.g. business / admin).
   */
  get(): Promise<ConsultantDashboardSummaryResponseDto>;
}
