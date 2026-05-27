export interface IConsultantEarningsTrendPointResponse {
  period_label: string;
  /** Cleared earnings in the period (sum of CREDIT_CLEARED). */
  earned: string;
  /** New accruals in the period (sum of CREDIT_PENDING). */
  pending: string;
  /** Withdrawals in the period (sum of WITHDRAWAL). */
  withdrawn: string;
  /** Running cumulative sum of `earned` from the earliest bucket to this bucket. */
  cumulative_earned: string;
}

export interface IConsultantEarningsTrendResponse {
  currency: string;
  granularity: 'month' | 'week';
  points: IConsultantEarningsTrendPointResponse[];
  generated_at: string;
}
