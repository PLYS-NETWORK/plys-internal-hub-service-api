export interface IBillingDraftRatioResponse {
  /** Projects in `draft` (unpublished). */
  draft_count: number;
  /** Projects with at least one paid publish (public + in_progress + done). */
  published_count: number;
  /** `draft_count + published_count`. */
  total_count: number;
  /** `draft_count / total_count`; `0` when total = 0. */
  draft_ratio: number;
  /** `published_count / total_count`; `0` when total = 0. */
  published_ratio: number;
  /**
   * Estimated revenue if all drafts were published, derived from the business's
   * average historical publish price × `draft_count`. Fixed-point string.
   * `"0.00"` when there is no publish history.
   */
  potential_revenue: string;
  /** ISO 4217 currency code. */
  currency: string;
}
