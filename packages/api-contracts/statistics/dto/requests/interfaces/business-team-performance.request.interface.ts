export type BusinessTeamPerformanceSort =
  | 'completed_tasks_desc'
  | 'on_time_pct_desc'
  | 'avg_cycle_asc';

export interface IBusinessTeamPerformanceRequest {
  /** ISO 8601 inclusive lower bound on `completed_at`. Defaults to first of current month. */
  from?: string;
  /** ISO 8601 inclusive upper bound on `completed_at`. Defaults to now. */
  to?: string;
  /** Max rows. Default 20, max 50. */
  limit: number;
  /** Metric to sort by. */
  sort: BusinessTeamPerformanceSort;
}
