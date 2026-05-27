export interface IOnboardingDecisionRequest {
  readonly decision: 'APPROVED' | 'REJECTED';
  readonly rejection_note?: string;
}
