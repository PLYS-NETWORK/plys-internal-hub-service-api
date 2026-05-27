export interface IConsultantProjectJoinedEvent {
  readonly consultant_user_id: string;
  /** Consultant's display name. Resolved at event-emit time so listeners
   *  don't each hit the DB. Used by admin + business notification copy. */
  readonly consultant_name: string;
  readonly project_id: string;
  readonly project_code: string;
  readonly project_title: string;
  readonly business_id: string;
  /** Owning business user — recipient of the business-side notification. */
  readonly business_user_id: string;
}

export interface IConsultantProjectLeftEvent {
  readonly consultant_user_id: string;
  readonly consultant_name: string;
  readonly project_id: string;
  readonly project_code: string;
  readonly project_title: string;
  readonly business_id: string;
  readonly business_user_id: string;
}

export interface IConsultantOnboardingSubmittedEvent {
  readonly consultant_user_id: string;
  readonly consultant_name: string;
  readonly onboarding_id: string;
}

export interface IConsultantOnboardingApprovedEvent {
  readonly consultant_user_id: string;
  readonly onboarding_id: string;
}

export interface IConsultantOnboardingRejectedEvent {
  readonly consultant_user_id: string;
  readonly onboarding_id: string;
  // ISO-8601 — when the 3-month re-onboarding block lifts.
  readonly blocked_until: string;
  // Plain-text reason the admin gave at decision time; null when the admin omitted it.
  readonly rejection_note: string | null;
}

export interface IConsultantSkillExamSubmittedEvent {
  readonly consultant_user_id: string;
  readonly exam_id: string;
  readonly skill_id: string;
  readonly skill_name: string;
}

export interface IConsultantSkillExamFailedEvent {
  readonly consultant_user_id: string;
  readonly exam_id: string;
  readonly skill_id: string;
  readonly skill_name: string;
  readonly fail_reason: 'LOW_SCORE' | 'COPYLEAKS_FAILED' | 'EXPIRED';
  readonly final_score: number;
  // Per-skill cooldown ISO timestamp; null for EXPIRED (no per-skill cooldown).
  readonly cooldown_until: string | null;
  readonly strike_count: number;
  readonly assigned_proficiency: 'beginner' | 'intermediate' | null;
}

export interface IConsultantSkillExamPassedEvent {
  readonly consultant_user_id: string;
  readonly exam_id: string;
  readonly skill_id: string;
  readonly skill_name: string;
  readonly final_score: number;
  readonly proficiency_level: 'senior' | 'expert';
}

export interface IConsultantAccountBannedEvent {
  readonly consultant_user_id: string;
  readonly ban_reason: 'AI_CONTENT_ABUSE';
  readonly banned_at: string;
}
