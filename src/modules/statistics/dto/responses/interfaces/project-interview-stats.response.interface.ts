export interface IProjectInterviewStatsResponse {
  /** Total projects owned by the caller. */
  total_projects: number;
  /** Projects that have at least one interview question configured. */
  with_questions_count: number;
  /** Projects with no interview questions configured. */
  without_questions_count: number;
  /** `with_questions_count / total_projects`; `0` when total = 0. */
  adoption_rate: number;
}
