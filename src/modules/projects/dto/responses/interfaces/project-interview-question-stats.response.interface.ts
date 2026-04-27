export interface IInterviewQuestionStatItem {
  question_id: string;
  /** 1-indexed display order. */
  position: number;
  question_text: string;
  answer_count: number;
  /** `total_applicants − answer_count`; `0` when no applicants. */
  skip_count: number;
  /** `answer_count / total_applicants`; `0` when no applicants. */
  completion_rate: number;
}

export interface IProjectInterviewQuestionStatsResponse {
  project_id: string;
  total_applicants: number;
  total_questions: number;
  questions: IInterviewQuestionStatItem[];
  /** Mean of all per-question completion rates; `0` when no questions. */
  avg_completion_rate: number;
}
