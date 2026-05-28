export type ISubmitOnboardingAnswerValueRequest =
  | { readonly text: string }
  | { readonly value: string }
  | { readonly values: string[] };

export interface ISubmitOnboardingAnswerItem {
  readonly onboardingQuestionId: string;
  readonly answerValue: ISubmitOnboardingAnswerValueRequest;
}

export interface ISubmitOnboardingAnswersRequest {
  readonly answers: ISubmitOnboardingAnswerItem[];
}
