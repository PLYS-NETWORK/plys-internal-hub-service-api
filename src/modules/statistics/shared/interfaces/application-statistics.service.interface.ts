import { PendingApplicationsDto } from '../../dto/requests/pending-applications.dto';
import { StatsDateRangeDto } from '../../dto/requests/stats-date-range.dto';
import { ApplicationFunnelResponseDto } from '../../dto/responses/application-funnel-response.dto';
import { ApplicationsPerProjectResponseDto } from '../../dto/responses/applications-per-project-response.dto';
import { PendingApplicationsResponseDto } from '../../dto/responses/pending-applications-response.dto';

export interface IApplicationStatisticsService {
  /**
   * Returns the consultant-application funnel (applied → reviewed → approved
   * → active) along with per-stage and overall conversion rates.
   *
   * @param query Optional date range / project filter.
   * @returns Per-stage counts + conversion rates.
   */
  getFunnel(query: StatsDateRangeDto): Promise<ApplicationFunnelResponseDto>;

  /**
   * Returns application volume per project, split by status (pending /
   * approved / rejected). Drives the "applications per project" column chart.
   *
   * @param query Optional date range / project filter.
   * @returns Per-project counts.
   */
  getPerProject(query: StatsDateRangeDto): Promise<ApplicationsPerProjectResponseDto>;

  /**
   * Returns a paginated list of `pending` applications across the caller's
   * projects, including whether the consultant answered all interview
   * questions so reviewers can prioritise.
   *
   * @param query Pagination parameters (`page`, `page_size`).
   * @returns Flat envelope: total + items + paging metadata.
   */
  getPending(query: PendingApplicationsDto): Promise<PendingApplicationsResponseDto>;
}
