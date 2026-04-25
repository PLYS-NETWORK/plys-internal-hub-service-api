export interface IProjectInterviewQuestionResponse {
  /** UUID of the interview question record. */
  id: string;
  /** The full text of the question shown to the applicant. */
  question_text: string;
  /** 1-based position controlling the order in which questions are displayed. */
  display_order: number;
  /** `true` when the applicant must answer this question to submit an application. */
  is_required: boolean;
}
