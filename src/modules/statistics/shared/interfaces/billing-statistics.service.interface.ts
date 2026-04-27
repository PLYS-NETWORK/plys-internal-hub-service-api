import { StatsDateRangeDto } from '../../dto/requests/stats-date-range.dto';
import { BillingDraftRatioResponseDto } from '../../dto/responses/billing-draft-ratio-response.dto';
import { BillingSpendTrendResponseDto } from '../../dto/responses/billing-spend-trend-response.dto';
import { BillingSummaryResponseDto } from '../../dto/responses/billing-summary-response.dto';

export interface IBillingStatisticsService {
  /**
   * Returns the caller's cumulative publishing spend, count of paid projects,
   * and most-recent payment timestamp.
   *
   * @returns Summary KPI fields. `last_payment_at` is null when no payments exist.
   */
  getSummary(): Promise<BillingSummaryResponseDto>;

  /**
   * Returns monthly publishing spend with a running cumulative total — drives
   * either a bar chart (per-period) or an area chart (cumulative) from a
   * single payload.
   *
   * @param query Optional date range filter.
   * @returns Time-series spend data.
   */
  getSpendTrend(query: StatsDateRangeDto): Promise<BillingSpendTrendResponseDto>;

  /**
   * Returns the draft / published split with an estimated potential revenue
   * (drafts × business's average publish price).
   *
   * @returns Draft ratio + potential revenue.
   */
  getDraftRatio(): Promise<BillingDraftRatioResponseDto>;
}
