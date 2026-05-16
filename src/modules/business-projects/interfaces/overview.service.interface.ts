import { OverviewResponseDto } from '../dto/responses/overview-response.dto';

/**
 * Single-endpoint, owner-facing project overview. Returns six blocks in one
 * round-trip: summary, health, money, team, action_items, activity.
 */
export interface IBusinessProjectOverviewService {
  /**
   * Returns the project overview for the calling business.
   *
   * Pipeline:
   *   1. Resolve owned project (404 / 403 as documented below).
   *   2. Try the per-project Redis cache; on hit, return.
   *   3. Fan-out the ~13 parallel reads; merge into the response payload.
   *   4. Write back to the cache (best-effort).
   *
   * @param projectId Project to render the overview for.
   * @returns Populated overview DTO. `money.projected_monthly_bill` is
   *   `null` for `payment_type = PER_TASK` projects.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND when the
   *   authenticated user has no business profile or the JWT businessId does
   *   not match the user.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project does
   *   not belong to the calling business.
   */
  getOverview(projectId: string): Promise<OverviewResponseDto>;
}
