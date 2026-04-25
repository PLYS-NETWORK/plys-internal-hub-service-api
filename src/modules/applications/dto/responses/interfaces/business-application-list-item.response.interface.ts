export interface IConsultantSummary {
  /** UUID of the consultant profile. */
  readonly id: string;
  /** Full display name of the consultant. */
  readonly full_name: string;
  /** CDN URL of the consultant's profile avatar; `null` when no avatar has been uploaded. */
  readonly avatar_url: string | null;
}

export interface IBusinessApplicationListItemResponse {
  /** UUID of the application record. */
  readonly id: string;
  /** UUID of the project this application was submitted for. */
  readonly project_id: string;
  /** Condensed consultant profile embedded in the list item to avoid an extra API call. */
  readonly consultant: IConsultantSummary;
  /** Current review status of the application (e.g. `pending`, `approved`, `rejected`). */
  readonly status: string;
  /** Cover letter text submitted by the consultant; `null` when not provided. */
  readonly cover_letter: string | null;
  /** ISO 8601 timestamp string of when the application was submitted. */
  readonly applied_at: string;
  /** ISO 8601 timestamp string of when the business reviewed the application; `null` until reviewed. */
  readonly reviewed_at: string | null;
}
