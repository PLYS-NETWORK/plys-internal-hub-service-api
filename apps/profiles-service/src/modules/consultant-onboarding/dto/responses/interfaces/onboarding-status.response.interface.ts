export interface IOnboardingStatusResponse {
  readonly id: string;
  readonly status: string;
  readonly decision: string | null;
  readonly rejection_note: string | null;
  readonly blocked_until: string | null;
  readonly profile_submitted_at: string | null;
  readonly interview_submitted_at: string | null;
  readonly reviewed_at: string | null;
  readonly created_at: string;
}
