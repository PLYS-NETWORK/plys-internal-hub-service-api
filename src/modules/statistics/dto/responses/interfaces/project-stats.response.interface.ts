import { ProjectStatus } from '@database/enums';

export interface IProjectStatsResponse {
  /** Total number of projects owned by the caller. */
  total: number;
  /** Project counts keyed by `ProjectStatus`. Statuses with zero count are still present. */
  by_status: Record<ProjectStatus, number>;
  /** Ratio of paid-lifetime projects (public + in_progress + done) over total. `0` when total = 0. */
  published_ratio: number;
}
