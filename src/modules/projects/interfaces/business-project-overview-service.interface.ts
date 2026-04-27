import { ActivityFeedDto } from '../dto/requests/activity-feed.dto';
import {
  ProjectActivityFeedResponseDto,
  ProjectApplicationStatsResponseDto,
  ProjectHeaderResponseDto,
  ProjectInterviewQuestionStatsResponseDto,
  ProjectMembersOverviewResponseDto,
  ProjectTaskStatsResponseDto,
} from '../dto/responses';

/**
 * Read-only "project overview" facade for the BUSINESS platform. Each method
 * resolves the caller's business profile via `RequestContextService` and
 * verifies project ownership before responding — every method throws
 * `PROJECT_NOT_FOUND` (404) if the project doesn't belong to the caller.
 */
export interface IBusinessProjectOverviewService {
  /**
   * Returns the project header — id, title, introduction, status, dates,
   * owner, and most-recent publish payment.
   *
   * @throws TranslatableException(PROJECT_NOT_FOUND, 404) when the project
   *         doesn't exist or doesn't belong to the caller.
   */
  getHeader(projectId: string): Promise<ProjectHeaderResponseDto>;

  /**
   * Returns the active member roster + pending-approval count for a single
   * project. `last_active_at` is derived from `User.lastLoginAt`;
   * `activity_status` is bucketed server-side.
   */
  getMembers(projectId: string): Promise<ProjectMembersOverviewResponseDto>;

  /**
   * Per-question completion stats: how many applicants answered each
   * interview question (vs. skipped it).
   */
  getInterviewStats(projectId: string): Promise<ProjectInterviewQuestionStatsResponseDto>;

  /**
   * Paginated, reverse-chronological activity feed for the project.
   *
   * @param query Pagination + optional `types` filter.
   */
  getActivity(projectId: string, query: ActivityFeedDto): Promise<ProjectActivityFeedResponseDto>;

  /** Kanban breakdown — task counts grouped by `kanban_status`. */
  getTaskStats(projectId: string): Promise<ProjectTaskStatsResponseDto>;

  /** Application breakdown — total + per-status counts (4 buckets). */
  getApplicationStats(projectId: string): Promise<ProjectApplicationStatsResponseDto>;
}
