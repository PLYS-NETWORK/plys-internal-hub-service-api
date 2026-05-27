export type AdminGrowthTrendGranularity = 'month' | 'week';

export interface IAdminGrowthTrendRequest {
  /** ISO 8601 inclusive lower bound on `created_at`. */
  from?: string;
  /** ISO 8601 inclusive upper bound on `created_at`. */
  to?: string;
  /** Bucket size for the time series. Defaults to `month`. */
  granularity: AdminGrowthTrendGranularity;
}
