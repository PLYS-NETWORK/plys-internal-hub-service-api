import { OverviewResponseDto } from '../dto/responses/overview-response.dto';

/**
 * Single-endpoint aggregated overview for the business dashboard top page.
 * Replaces the legacy 6-endpoint surface with one round trip.
 */
export interface IBusinessProjectOverviewService {
  /**
   * Returns the full dashboard overview for the given project. All 6 sections
   * are computed in parallel; activity feed is capped to the most recent 20
   * events (the legacy `/overview/activity` paged endpoint is intentionally
   * not ported).
   *
   * @param projectId Project to render the overview for.
   * @returns Composed overview with summary, statistics, task_statuses,
   *   team_members, application_breakdown, recent_activity.
   * @throws TranslatableException 403 BUSINESS_PROFILE_NOT_FOUND when the
   *   authenticated user has no business profile or the JWT businessId does
   *   not match the user.
   * @throws TranslatableException 404 PROJECT_NOT_FOUND when the project does
   *   not belong to the calling business.
   */
  getOverview(projectId: string): Promise<OverviewResponseDto>;
}
