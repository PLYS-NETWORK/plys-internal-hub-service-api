export type SkillExamEligibilityBlockReason =
  | 'pending_exam'
  | 'platform_block'
  | 'banned'
  | 'onboarding_not_approved';

export interface ISkillExamEligibilityDetails {
  readonly pending_exam_id?: string;
  readonly blocked_until?: string;
  readonly exam_expired_count?: number;
  readonly ban_reason?: string;
}

export interface ISkillExamEligibilityResponse {
  readonly can_register: boolean;
  readonly reason: SkillExamEligibilityBlockReason | null;
  readonly details: ISkillExamEligibilityDetails;
}
