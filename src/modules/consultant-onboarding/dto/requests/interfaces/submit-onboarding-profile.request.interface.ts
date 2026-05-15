export interface ISubmitOnboardingProfileRequest {
  readonly full_name: string;
  readonly bio: string;
  readonly years_of_experience: number;
  readonly phone_number: string;
  readonly country_code: string;
  readonly avatar_url?: string;
  readonly cv_url?: string;
}
