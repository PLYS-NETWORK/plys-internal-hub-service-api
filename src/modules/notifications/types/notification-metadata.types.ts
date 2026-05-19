import { NOTIFICATION_TYPES, NotificationType } from '../enums/notification-type.enum';

// One metadata interface per notification type. Keys are snake_case because
// they round-trip through JSON (Redis pub/sub + Socket.IO emit) without any
// transform layer between the dispatcher and the FE.

// ── User / account ─────────────────────────────────────────────────────────

export interface IProfileUpdatedMetadata {
  /** snake_case names of the columns that changed in this update. */
  updated_fields: string[];
}

export interface IPasswordChangedMetadata {
  device_id: string | null;
  ip_address: string;
}

// ── Business: project & task ────────────────────────────────────────────────

export interface IProjectPublishedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
}

export interface IProjectUnpublishedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  /** Refund amount in major units; only present when the project was pre-paid. */
  refund_amount?: number;
}

export interface ITaskPublishedMetadata {
  task_id: string;
  task_code: string;
  task_title: string;
  project_id: string;
  project_code: string;
}

export interface IProjectConsultantJoinedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  consultant_user_id: string;
  consultant_name: string;
}

export interface IProjectConsultantLeftMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  consultant_user_id: string;
  consultant_name: string;
}

export interface IBusinessTaskStatusChangedMetadata {
  task_id: string;
  task_code: string;
  task_title: string;
  project_id: string;
  consultant_user_id: string;
  old_status: string;
  new_status: string;
}

// ── Business: finance ───────────────────────────────────────────────────────

export interface ITopUpCompletedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number;
  currency: string;
  new_balance: number;
}

export interface ITopUpRefundedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number;
  currency: string;
}

export interface IWithdrawCompletedMetadata {
  transaction_id: string;
  transaction_number: string;
  amount: number;
  currency: string;
  new_balance: number;
}

export interface IWithdrawReversedMetadata extends IWithdrawCompletedMetadata {
  reason: string;
}

// ── Consultant ──────────────────────────────────────────────────────────────

export interface IConsultantProjectSkillMatchMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  business_id: string;
}

export interface IConsultantProjectJoinedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  business_id: string;
}

export interface IConsultantTaskStatusChangedMetadata {
  task_id: string;
  task_code: string;
  task_title: string;
  project_id: string;
  old_status: string;
  new_status: string;
  // Populated when new_status=done: decimal string (post-platform-fee payout).
  earned_amount?: string;
  // Populated when new_status=revision_requested: consolidated reviewer feedback.
  feedback_summary?: string;
  // Populated on every review-workflow transition out of IN_REVIEW.
  revision_count?: number;
  revisions_remaining?: number;
}

/** Metadata for a TASK_REVIEWER_REVIEW_ASSIGNED notification. */
export interface ITaskReviewerReviewAssignedMetadata {
  review_id: string;
  task_id: string;
  task_code: string;
  task_title: string;
  project_id: string;
  round_number: number;
  is_arbiter: boolean;
}

export interface IConsultantOnboardingApprovedMetadata {
  onboarding_id: string;
}

export interface IConsultantOnboardingRejectedMetadata {
  onboarding_id: string;
  /** ISO-8601 — when the 3-month re-onboarding block lifts. */
  blocked_until: string;
  /** Admin's plain-text reason; null when omitted. */
  rejection_note: string | null;
}

export interface IConsultantSkillExamSubmittedMetadata {
  exam_id: string;
  skill_id: string;
  /** i18n skill key (e.g. `skill_react`); resolved on the FE / in copy. */
  skill_name: string;
}

export interface IConsultantSkillExamFailedMetadata {
  exam_id: string;
  skill_id: string;
  skill_name: string;
  fail_reason: 'LOW_SCORE' | 'COPYLEAKS_FAILED' | 'EXPIRED';
  /** 0–100; 0 when Copyleaks fails before AI eval runs or when the exam EXPIRED. */
  final_score: number;
  /** ISO-8601. Null for EXPIRED (no per-skill cooldown). */
  cooldown_until: string | null;
  /** users.ai_strike_count after this event. */
  strike_count: number;
  /** 3 - strike_count (floored at 0). */
  strikes_remaining: number;
  /** Score-band level when fail_reason='LOW_SCORE'; null for COPYLEAKS_FAILED/EXPIRED. */
  assigned_proficiency: 'beginner' | 'intermediate' | null;
}

export interface IConsultantSkillExamPassedMetadata {
  exam_id: string;
  skill_id: string;
  skill_name: string;
  /** 0–100. */
  final_score: number;
  proficiency_level: 'senior' | 'expert';
  /** True when avgRating ≥ 90 (drives email/notification priority on new projects). */
  has_priority_benefit: boolean;
}

export interface IConsultantAccountBannedMetadata {
  ban_reason: 'AI_CONTENT_ABUSE';
  /** ISO-8601. */
  banned_at: string;
}

// ── Admin ───────────────────────────────────────────────────────────────────

export interface IAdminBusinessOnboardedMetadata {
  business_id: string;
  business_name: string;
}

export interface IAdminProjectPublishedMetadata {
  project_id: string;
  project_code: string;
  project_title: string;
  business_id: string;
  business_name: string;
}

export interface IAdminBusinessTopUpMetadata {
  transaction_id: string;
  transaction_number: string;
  business_id: string;
  business_name: string;
  amount: number;
  currency: string;
}

export interface IAdminTaskPublishedMetadata {
  task_id: string;
  task_code: string;
  task_title: string;
  project_id: string;
  project_code: string;
  business_name: string;
}

export interface IAdminConsultantOnboardingSubmittedMetadata {
  onboarding_id: string;
  consultant_user_id: string;
  consultant_name: string;
}

export interface IAdminSkillExamResultMetadata {
  /** Terminal outcome the admin should review. */
  outcome: 'PASSED' | 'LOW_SCORE' | 'COPYLEAKS_FAILED' | 'EXPIRED';
  exam_id: string;
  consultant_user_id: string;
  consultant_name: string;
  skill_id: string;
  skill_name: string;
  /** 0–100. 0 when CopyLeaks fails before AI eval or when the exam EXPIRED. */
  final_score: number;
  /** Set on PASSED only. */
  proficiency_level?: 'senior' | 'expert';
  /** Set on LOW_SCORE fails; null/absent for COPYLEAKS_FAILED + EXPIRED. */
  assigned_proficiency?: 'beginner' | 'intermediate' | null;
  /** ISO-8601 per-skill cooldown. Null for EXPIRED (no per-skill cooldown). */
  cooldown_until?: string | null;
  /** users.ai_strike_count after this event. */
  strike_count?: number;
}

export interface IAdminConsultantBannedMetadata {
  consultant_user_id: string;
  consultant_name: string;
  ban_reason: 'AI_CONTENT_ABUSE';
  /** ISO-8601. */
  banned_at: string;
  /** Final strike count that triggered the ban (typically 3). */
  ai_strike_count: number;
}

export interface IAdminConsultantProjectJoinedMetadata {
  consultant_user_id: string;
  consultant_name: string;
  project_id: string;
  project_code: string;
  project_title: string;
  business_id: string;
  business_name: string;
}

export interface IAdminConsultantProjectLeftMetadata {
  consultant_user_id: string;
  consultant_name: string;
  project_id: string;
  project_code: string;
  project_title: string;
  business_id: string;
  business_name: string;
}

// Mapped type binding each discriminator value to its metadata shape.
// Used by the dispatcher's generic signature so passing a wrong-shaped
// metadata for a given type is a compile error.
export type NotificationMetadataMap = {
  [NOTIFICATION_TYPES.PROFILE_UPDATED]: IProfileUpdatedMetadata;
  [NOTIFICATION_TYPES.PASSWORD_CHANGED]: IPasswordChangedMetadata;
  [NOTIFICATION_TYPES.PROJECT_PUBLISHED]: IProjectPublishedMetadata;
  [NOTIFICATION_TYPES.PROJECT_UNPUBLISHED]: IProjectUnpublishedMetadata;
  [NOTIFICATION_TYPES.TASK_PUBLISHED]: ITaskPublishedMetadata;
  [NOTIFICATION_TYPES.PROJECT_CONSULTANT_JOINED]: IProjectConsultantJoinedMetadata;
  [NOTIFICATION_TYPES.PROJECT_CONSULTANT_LEFT]: IProjectConsultantLeftMetadata;
  [NOTIFICATION_TYPES.BUSINESS_TASK_STATUS_CHANGED]: IBusinessTaskStatusChangedMetadata;
  [NOTIFICATION_TYPES.TOP_UP_COMPLETED]: ITopUpCompletedMetadata;
  [NOTIFICATION_TYPES.TOP_UP_REFUNDED]: ITopUpRefundedMetadata;
  [NOTIFICATION_TYPES.WITHDRAW_COMPLETED]: IWithdrawCompletedMetadata;
  [NOTIFICATION_TYPES.WITHDRAW_REVERSED]: IWithdrawReversedMetadata;
  [NOTIFICATION_TYPES.CONSULTANT_PROJECT_SKILL_MATCH]: IConsultantProjectSkillMatchMetadata;
  [NOTIFICATION_TYPES.CONSULTANT_PROJECT_JOINED]: IConsultantProjectJoinedMetadata;
  [NOTIFICATION_TYPES.CONSULTANT_TASK_STATUS_CHANGED]: IConsultantTaskStatusChangedMetadata;
  [NOTIFICATION_TYPES.CONSULTANT_ONBOARDING_APPROVED]: IConsultantOnboardingApprovedMetadata;
  [NOTIFICATION_TYPES.CONSULTANT_ONBOARDING_REJECTED]: IConsultantOnboardingRejectedMetadata;
  [NOTIFICATION_TYPES.CONSULTANT_SKILL_EXAM_SUBMITTED]: IConsultantSkillExamSubmittedMetadata;
  [NOTIFICATION_TYPES.CONSULTANT_SKILL_EXAM_FAILED]: IConsultantSkillExamFailedMetadata;
  [NOTIFICATION_TYPES.CONSULTANT_SKILL_EXAM_PASSED]: IConsultantSkillExamPassedMetadata;
  [NOTIFICATION_TYPES.CONSULTANT_ACCOUNT_BANNED]: IConsultantAccountBannedMetadata;
  [NOTIFICATION_TYPES.TASK_REVIEWER_REVIEW_ASSIGNED]: ITaskReviewerReviewAssignedMetadata;
  [NOTIFICATION_TYPES.ADMIN_BUSINESS_ONBOARDED]: IAdminBusinessOnboardedMetadata;
  [NOTIFICATION_TYPES.ADMIN_PROJECT_PUBLISHED]: IAdminProjectPublishedMetadata;
  [NOTIFICATION_TYPES.ADMIN_BUSINESS_TOP_UP]: IAdminBusinessTopUpMetadata;
  [NOTIFICATION_TYPES.ADMIN_TASK_PUBLISHED]: IAdminTaskPublishedMetadata;
  [NOTIFICATION_TYPES.ADMIN_CONSULTANT_ONBOARDING_SUBMITTED]: IAdminConsultantOnboardingSubmittedMetadata;
  [NOTIFICATION_TYPES.ADMIN_SKILL_EXAM_RESULT]: IAdminSkillExamResultMetadata;
  [NOTIFICATION_TYPES.ADMIN_CONSULTANT_BANNED]: IAdminConsultantBannedMetadata;
  [NOTIFICATION_TYPES.ADMIN_CONSULTANT_PROJECT_JOINED]: IAdminConsultantProjectJoinedMetadata;
  [NOTIFICATION_TYPES.ADMIN_CONSULTANT_PROJECT_LEFT]: IAdminConsultantProjectLeftMetadata;
};

// The discriminated-union the FE consumes — TS narrows `metadata` automatically
// when the FE switches on `n.type`.
export type NotificationPayload = {
  [K in NotificationType]: {
    id: string;
    type: K;
    title: string;
    body: string;
    metadata: NotificationMetadataMap[K];
    entity_type: string;
    entity_id: string;
    redirect_url: string | null;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    actor_id: string | null;
  };
}[NotificationType];
