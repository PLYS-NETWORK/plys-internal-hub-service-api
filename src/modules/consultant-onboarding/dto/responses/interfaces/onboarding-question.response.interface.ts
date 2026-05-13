export interface IOnboardingQuestionResponse {
  readonly id: string;
  readonly onboarding_question_id: string;
  readonly question_order: number;
  readonly type: string;
  readonly content: string;
  readonly answer_text: string | null;
}
