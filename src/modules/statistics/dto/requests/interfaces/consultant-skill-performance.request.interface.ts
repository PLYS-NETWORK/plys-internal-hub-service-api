export type ConsultantSkillPerformanceSort =
  | 'completed_tasks_desc'
  | 'earnings_desc'
  | 'rating_desc';

export interface IConsultantSkillPerformanceRequest {
  /** Page size cap; default 20, server caps at 50. */
  limit: number;
  /** Sort order. Null-aware for `rating` so unrated skills sink to the bottom. */
  sort: ConsultantSkillPerformanceSort;
}
