export interface IStatsDateRangeRequest {
  /** ISO 8601 lower bound. Inclusive. */
  from?: string;
  /** ISO 8601 upper bound. Inclusive. */
  to?: string;
  /** Restrict aggregation to a single project. */
  projectId?: string;
  /** IANA timezone applied to date-only `from`/`to` shorthand. */
  tz?: string;
}
