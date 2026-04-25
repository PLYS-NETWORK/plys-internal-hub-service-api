export interface IProjectSummary {
  /** UUID of the project. */
  readonly id: string;
  /** Human-readable project title. */
  readonly title: string;
}

export interface IConsultantApplicationListItemResponse {
  /** UUID of the application record. */
  readonly id: string;
  /** Condensed project details embedded in the list item to avoid an extra API call. */
  readonly project: IProjectSummary;
  /** Current review status of the application (e.g. `pending`, `approved`, `rejected`). */
  readonly status: string;
  /** Cover letter text submitted by the consultant; `null` when not provided. */
  readonly cover_letter: string | null;
  /** ISO 8601 timestamp string of when the application was submitted. */
  readonly applied_at: string;
}
