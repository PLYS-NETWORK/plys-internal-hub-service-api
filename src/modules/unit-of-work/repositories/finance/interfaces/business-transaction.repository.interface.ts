import { AbstractRepository } from '@common/repositories';
import { BusinessTransaction } from '@database/entities';

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
}
