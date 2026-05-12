export interface IConsultantInterviewSubmittedEvent {
  readonly application_id: string;
  readonly consultant_user_id: string;
  readonly consultant_name: string;
}

export interface IConsultantApplicationAiRejectedEvent {
  readonly application_id: string;
  readonly consultant_user_id: string;
  readonly consultant_name: string;
}

export interface IConsultantProjectJoinedEvent {
  readonly consultant_user_id: string;
  readonly project_id: string;
  readonly project_code: string;
  readonly project_title: string;
  readonly business_id: string;
}

export interface IConsultantOnboardingApprovedEvent {
  readonly consultant_user_id: string;
  readonly onboarding_id: string;
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
  readonly fail_reason: 'LOW_SCORE' | 'COPYLEAKS_FAILED';
  readonly final_score: number;
  readonly cooldown_until: string;
  readonly strike_count: number;
}

export interface IConsultantSkillExamPassedEvent {
  readonly consultant_user_id: string;
  readonly exam_id: string;
  readonly skill_id: string;
  readonly skill_name: string;
  readonly final_score: number;
  readonly proficiency_level: 'advanced' | 'expert';
}

export interface IConsultantAccountBannedEvent {
  readonly consultant_user_id: string;
  readonly ban_reason: 'AI_CONTENT_ABUSE';
  readonly banned_at: string;
}
