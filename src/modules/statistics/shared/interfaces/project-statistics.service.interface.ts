import { ProjectsTrendDto } from '../../dto/requests/projects-trend.dto';
import { StatsDateRangeDto } from '../../dto/requests/stats-date-range.dto';
import { ProjectInterviewStatsResponseDto } from '../../dto/responses/project-interview-stats-response.dto';
import { ProjectStatsResponseDto } from '../../dto/responses/project-stats-response.dto';
import { ProjectTrendResponseDto } from '../../dto/responses/project-trend-response.dto';

export interface IProjectStatisticsService {
  /**
   * Aggregates project counts grouped by lifecycle status for the caller.
   *
   * @param query Optional date range / project filter.
   * @returns Total + per-status counts + published-ratio.
   * @throws TranslatableException(BUSINESS_PROFILE_NOT_FOUND) when the caller
   *         has no business profile (business scope only).
   */
  getStats(query: StatsDateRangeDto): Promise<ProjectStatsResponseDto>;

  /**
   * Returns project creation + publish counts grouped by week or month.
   *
   * @param query Period (`weekly` | `monthly`) and optional date range.
   * @returns Time-series data points covering the selected range.
   */
  getTrend(query: ProjectsTrendDto): Promise<ProjectTrendResponseDto>;

  /**
   * Returns interview-question adoption metrics — how many of the caller's
   * projects ship with at least one interview question.
   *
   * @returns Adoption counts and rate.
   */
  getInterviewStats(): Promise<ProjectInterviewStatsResponseDto>;
}
