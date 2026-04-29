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

export interface ILatestPublishPayment {
  /** Total amount charged for the publish — fixed-point string. */
  amount: string;
  /** Timestamp when the transaction was recorded. */
  paid_at: Date;
  /** ISO 4217 currency code. */
  currency: string;
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
   * Returns the most recent completed `PROJECT_PUBLISHED` transaction for a
   * single project. Used by the project overview header to populate the
   * `payment` block. `null` when the project has not been paid for yet.
   */
  findLatestPublishPaymentByProjectId(projectId: string): Promise<ILatestPublishPayment | null>;

  /**
   * Bulk-loads the latest completed `PROJECT_PUBLISHED` `total_amount` per
   * project in a single round-trip. Used by the business project list to
   * decide between "transaction total" (when present) and "task-price sum"
   * (fallback) for the displayed cost. Projects without a completed publish
   * transaction are absent from the map.
   *
   * @param projectIds - Project UUIDs to look up.
   * @returns Map of `projectId → totalAmount` (fixed-point string).
   */
  findPublishPaymentsByProjectIds(projectIds: string[]): Promise<Map<string, string>>;
}
