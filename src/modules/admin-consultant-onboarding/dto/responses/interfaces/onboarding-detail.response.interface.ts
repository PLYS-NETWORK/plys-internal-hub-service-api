import { IOnboardingQuestionSnapshot, OnboardingAnswerValue } from '@database/entities';

export interface IOnboardingAnswerView {
  readonly id: string;
  readonly onboarding_question_id: string;
  readonly question_snapshot: IOnboardingQuestionSnapshot;
  readonly answer_value: OnboardingAnswerValue;
  readonly submitted_at: string;
}

export interface IOnboardingDetailResponse {
  readonly id: string;
  readonly user_id: string;
  readonly consultant_email: string;
  readonly consultant_name: string;
  readonly bio: string | null;
  readonly years_of_experience: number | null;
  readonly phone_number: string | null;
  readonly country_code: string | null;
  readonly avatar_url: string | null;
  readonly cv_url: string | null;
  readonly status: string;
  readonly decision: string | null;
  readonly rejection_note: string | null;
  readonly blocked_until: string | null;
  readonly profile_submitted_at: string | null;
  readonly interview_submitted_at: string | null;
  readonly reviewed_at: string | null;
  readonly reviewed_by: string | null;
  readonly created_at: string;
  readonly answers: IOnboardingAnswerView[];
}
