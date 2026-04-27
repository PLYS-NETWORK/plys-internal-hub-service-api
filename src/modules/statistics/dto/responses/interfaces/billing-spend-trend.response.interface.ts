export interface IBillingSpendTrendPoint {
  /** `YYYY-MM` period label. */
  period_label: string;
  /** Spend in this period (fixed-point string). */
  amount: string;
  /** Running total from earliest period to this one (fixed-point string). */
  cumulative_amount: string;
}

export interface IBillingSpendTrendResponse {
  currency: string;
  data: IBillingSpendTrendPoint[];
}
