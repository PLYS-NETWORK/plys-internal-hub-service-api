export interface IProjectTrendPointResponse {
  /** Period label: `YYYY-MM` for monthly, `YYYY-Www` (ISO week) for weekly. */
  period_label: string;
  /** Projects whose `created_at` falls inside this period. */
  created_count: number;
  /** Projects published (paid) inside this period — `published_at` falls inside the period. */
  published_count: number;
}
