/**
 * Single bucket in the growth-trend series. Every bucket carries a
 * `period_label` plus one value per metric. Buckets are aligned —
 * a missing metric for a bucket lands as `0` / `'0.00'`, never absent.
 *
 * `period_label` format: `YYYY-MM` (granularity = month) or `IYYY-IW`
 * (granularity = week, ISO year + ISO week number).
 */
export interface IAdminGrowthTrendPoint {
  period_label: string;
  new_consultants: number;
  new_businesses: number;
  /** Decimal string, fixed-point from Postgres. */
  gmv: string;
  /** Decimal string, fixed-point from Postgres. */
  payouts: string;
}

export interface IAdminGrowthTrendResponse {
  /** Granularity echoed back so the FE doesn't need to remember its own request. */
  granularity: 'month' | 'week';
  /** ISO 4217 code for the financial series; always `USD` today. */
  currency: string;
  /** Ascending by `period_label`. */
  points: IAdminGrowthTrendPoint[];
}
