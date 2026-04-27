export interface IBillingSummaryResponse {
  /** Cumulative amount paid to publish projects, fixed-point string. */
  total_spend: string;
  /** ISO 4217 currency code. */
  currency: string;
  /** Number of distinct projects paid for. */
  total_published_projects: number;
  /** Most-recent payment timestamp; `null` when no payments exist. */
  last_payment_at: Date | null;
}
