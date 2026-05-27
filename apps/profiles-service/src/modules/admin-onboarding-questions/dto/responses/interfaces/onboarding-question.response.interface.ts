import { OnboardingQuestionType } from '@plys/libraries/database/enums';

export interface IOnboardingQuestionOptionResponse {
  readonly value: string;
  readonly label: string;
}

export interface IOnboardingQuestionResponse {
  readonly id: string;
  readonly type: OnboardingQuestionType;
  readonly question: string;
  readonly options: IOnboardingQuestionOptionResponse[] | null;
  readonly position: number | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}
