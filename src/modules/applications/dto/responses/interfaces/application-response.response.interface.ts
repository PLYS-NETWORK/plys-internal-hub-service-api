export interface IMatchedSkillResponse {
  /** UUID of the skill in the global skills taxonomy. */
  readonly id: string;
  /** Human-readable display name of the matched skill. */
  readonly name: string;
}

export interface IApplicationResponse {
  /** UUID of the application record. */
  readonly id: string;
  /** UUID of the project the consultant applied to. */
  readonly project_id: string;
  /** Current review status of the application (e.g. `pending`, `approved`, `rejected`). */
  readonly status: string;
  /** Cover letter text submitted by the consultant; `null` when not provided. */
  readonly cover_letter: string | null;
  /** Skills from the consultant's profile that overlap with the project's required skills. */
  readonly matched_skills: IMatchedSkillResponse[];
  /** ISO 8601 timestamp string of when the application was submitted. */
  readonly applied_at: string;
}
