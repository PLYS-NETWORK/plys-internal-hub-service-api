/**
 * Per-platform user counts split into four lifecycle buckets. Buckets may
 * overlap (a banned user is also part of `total`) — admin UI renders them
 * as independent badges, not stacked segments.
 */
export interface IAdminUsersStatusCounts {
  total: number;
  active_30d: number;
  unverified: number;
  banned: number;
}

export interface IAdminUsersSummary {
  business: IAdminUsersStatusCounts;
  consultant: IAdminUsersStatusCounts;
}

export interface IAdminFinancialSummary {
  /** ISO 4217 code; currently always `USD`. */
  currency: string;
  /** Decimal string. Sum of completed TOP_UP + MONTHLY_BILLING in the current calendar month. */
  mtd_gmv: string;
  /** Decimal string. Sum of completed consultant WITHDRAWAL in the current calendar month. */
  mtd_payouts: string;
  /** Decimal string. Sum of `consultant_profiles.account_balance` across all consultants. */
  outstanding_payouts: string;
  /** Decimal string. Sum of `invoices.amount` where status is PENDING or OVERDUE. */
  outstanding_invoices: string;
}

export interface IAdminOperationalQueuesSummary {
  pending_consultant_onboardings: number;
  skill_exams_awaiting_review: number;
  open_task_disputes: number;
  overdue_invoices: number;
  pending_consultant_withdrawals: number;
}

export interface IAdminGrowthSummary {
  new_consultants_mtd: number;
  new_businesses_mtd: number;
  /** Percentage change in GMV vs the previous full calendar month. One decimal place, as a string. */
  gmv_delta_pct: string;
  /** Percentage change in consultant payouts vs the previous full calendar month. */
  payouts_delta_pct: string;
}

export interface IAdminDashboardSummaryResponse {
  users: IAdminUsersSummary;
  financial: IAdminFinancialSummary;
  queues: IAdminOperationalQueuesSummary;
  growth: IAdminGrowthSummary;
  /** ISO 8601 timestamp the snapshot was produced at. */
  generated_at: string;
}
