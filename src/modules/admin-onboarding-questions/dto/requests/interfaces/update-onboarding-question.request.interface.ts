import { IOnboardingQuestionOptionInput } from './onboarding-question-option.interface';

export interface IUpdateOnboardingQuestionRequest {
  readonly question?: string;
  readonly options?: IOnboardingQuestionOptionInput[] | null;
}
