import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { BusinessTransaction } from '@plys/libraries/database/entities';

export interface IPublishingSpendSummary {
  /** Cumulative `total_amount` for completed PROJECT_PUBLISHED transactions, fixed-point string. */
  total_spend: string;
  /** Distinct projects covered by completed PROJECT_PUBLISHED transactions. */
  total_published_projects: number;
  /** Most recent `created_at` over the same filter; `null` when no rows. */
  last_payment_at: Date | null;
}

export interface ISpendTrendPoint {
  /** `YYYY-MM` period label. */
  period_label: string;
  /** SUM(total_amount) inside this period — fixed-point string from Postgres. */
  amount: string;
}

/** Time-series point for platform-wide GMV (admin dashboard). */
export interface IGmvTrendPoint {
  /** `YYYY-MM` for monthly, `IYYY-IW` for weekly. */
  period_label: string;
  /** SUM(total_amount) inside this period — fixed-point string from Postgres. */
  amount: string;
}

/** Time-series point for a single business's outflow spend (business dashboard). */
export interface IBusinessSpendTrendPoint {
  period_label: string;
  amount: string;
}

/** A pending TOP_UP row surfaced in the business action-items endpoint. */
export interface IPendingTopUpRow {
  transaction_id: string;
  transaction_number: string;
  total_amount: string;
  created_at: Date;
  /** Polar checkout URL when the row has been to the processor at least once. */
  redirect_url: string | null;
}

export interface IBusinessTransactionRepository extends AbstractRepository<BusinessTransaction> {
  /**
   * Returns the publishing-spend summary for a business — total spend, distinct
   * projects paid for, and the most recent payment timestamp. Filters to
   * `type = PROJECT_PUBLISHED` and `status = COMPLETED`.
   */
  getPublishingSpendSummaryByBusinessId(businessId: string): Promise<IPublishingSpendSummary>;

  /**
   * Returns spend totals grouped by month for `PROJECT_PUBLISHED` / `COMPLETED`
   * transactions. Sorted ascending by `period_label`. The cumulative running
   * total is computed by the caller so callers can reuse the same query for
   * either bar or area charts.
   */
  sumPublishingSpendByBusinessIdGroupedByMonth(
    businessId: string,
    from?: string,
    to?: string,
  ): Promise<ISpendTrendPoint[]>;

  /**
   * Platform-wide GMV (gross merchandise value) in a window — sum of
   * `total_amount` for COMPLETED `TOP_UP` and `MONTHLY_BILLING` rows. Used by
   * the admin dashboard's financial KPIs.
   * @param from Inclusive lower bound on `created_at`.
   * @param to   Inclusive upper bound on `created_at`.
   * @returns Decimal string (`'0.00'` when empty).
   */
  sumGmvBetween(from: Date, to: Date): Promise<string>;

  /**
   * Platform-wide GMV grouped by period (admin dashboard growth chart).
   * Same filter as {@link sumGmvBetween}. Sorted ascending by `period_label`.
   */
  sumGmvGroupedByPeriod(
    from: Date,
    to: Date,
    granularity: 'month' | 'week',
  ): Promise<IGmvTrendPoint[]>;

  /**
   * Per-business spend window — sum of `total_amount` for completed rows
   * where `type IN (top_up, monthly_billing, project_published, task_added)`.
   * Used by the business-dashboard `mtd_spend` KPI.
   */
  sumBusinessOutflowBetween(businessId: string, from: Date, to: Date): Promise<string>;

  /**
   * Per-business spend grouped by period — same filter as
   * {@link sumBusinessOutflowBetween}. Sorted ascending by `period_label`.
   * The running cumulative is computed by the caller so the same query can
   * back either a bar chart or an area chart.
   */
  sumBusinessOutflowGroupedByPeriod(
    businessId: string,
    from: Date,
    to: Date,
    granularity: 'month' | 'week',
  ): Promise<IBusinessSpendTrendPoint[]>;

  /**
   * Count of `TOP_UP` rows in PENDING status for the given business. Used by
   * the business-dashboard action-counts KPI.
   */
  countPendingTopUpsByBusinessId(businessId: string): Promise<number>;

  /**
   * Top-N pending TOP_UPs sorted by `created_at` DESC (most recent first —
   * those are the ones the owner is most likely to resume).
   */
  findPendingTopUpsByBusinessId(businessId: string, limit: number): Promise<IPendingTopUpRow[]>;

  /**
   * Sum of `total_amount` for `TASK_ADDED` rows linked to the business's
   * single OPEN billing period. Powers the `projected_monthly_bill` KPI —
   * an estimate of what the next monthly invoice will charge if no further
   * tasks land before the period closes. Returns `'0.00'` when no open
   * period exists.
   */
  sumProjectedMonthlyBillByBusinessId(businessId: string): Promise<string>;

  /**
   * Per-project sum of completed outflow (`total_amount`) in the
   * month-to-date window — fed into the project-health table's `mtd_spend`
   * column. Same outflow filter as {@link sumBusinessOutflowBetween}.
   * Projects without spend in the window are absent from the map.
   */
  sumMtdSpendByProjectIds(projectIds: string[], from: Date, to: Date): Promise<Map<string, string>>;

  /**
   * Lifetime outflow on a single project grouped by `type`. Filters to
   * `status = COMPLETED AND project_id = ?`. Types absent from the result
   * map have zero spend. Used by the project-overview `money` block to
   * split `spent_on_publish` (PROJECT_PUBLISHED) vs. `spent_on_tasks`
   * (TASK_ADDED).
   */
  sumOutflowByProjectIdGroupedByType(projectId: string): Promise<Map<string, string>>;

  /**
   * Per-project projected monthly bill — sum of `total_amount` for
   * `TASK_ADDED` rows linked to the business's currently OPEN billing
   * period AND scoped to this project. Returns `'0.00'` when there are no
   * matching rows. Caller should only invoke for projects with
   * `payment_type = PER_MONTH`.
   */
  sumProjectedMonthlyBillByProjectId(projectId: string): Promise<string>;
}
