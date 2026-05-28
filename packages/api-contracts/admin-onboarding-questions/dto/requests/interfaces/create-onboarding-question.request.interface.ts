import { OnboardingQuestionType } from '@plys/libraries/database/enums';

import { IOnboardingQuestionOptionInput } from './onboarding-question-option.interface';

export interface ICreateOnboardingQuestionRequest {
  readonly type: OnboardingQuestionType;
  readonly question: string;
  readonly options?: IOnboardingQuestionOptionInput[];
  readonly isActive?: boolean;
}
