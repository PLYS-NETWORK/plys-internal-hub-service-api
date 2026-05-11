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

export interface IAdminConsultantInterviewSubmittedMetadata {
  application_id: string;
  consultant_name: string;
}

export interface IAdminConsultantAiRejectedMetadata {
  application_id: string;
  consultant_name: string;
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
  [NOTIFICATION_TYPES.TOP_UP_COMPLETED]: ITopUpCompletedMetadata;
  [NOTIFICATION_TYPES.TOP_UP_REFUNDED]: ITopUpRefundedMetadata;
  [NOTIFICATION_TYPES.WITHDRAW_COMPLETED]: IWithdrawCompletedMetadata;
  [NOTIFICATION_TYPES.WITHDRAW_REVERSED]: IWithdrawReversedMetadata;
  [NOTIFICATION_TYPES.CONSULTANT_PROJECT_SKILL_MATCH]: IConsultantProjectSkillMatchMetadata;
  [NOTIFICATION_TYPES.CONSULTANT_PROJECT_JOINED]: IConsultantProjectJoinedMetadata;
  [NOTIFICATION_TYPES.CONSULTANT_TASK_STATUS_CHANGED]: IConsultantTaskStatusChangedMetadata;
  [NOTIFICATION_TYPES.ADMIN_BUSINESS_ONBOARDED]: IAdminBusinessOnboardedMetadata;
  [NOTIFICATION_TYPES.ADMIN_PROJECT_PUBLISHED]: IAdminProjectPublishedMetadata;
  [NOTIFICATION_TYPES.ADMIN_BUSINESS_TOP_UP]: IAdminBusinessTopUpMetadata;
  [NOTIFICATION_TYPES.ADMIN_TASK_PUBLISHED]: IAdminTaskPublishedMetadata;
  [NOTIFICATION_TYPES.ADMIN_CONSULTANT_INTERVIEW_SUBMITTED]: IAdminConsultantInterviewSubmittedMetadata;
  [NOTIFICATION_TYPES.ADMIN_CONSULTANT_AI_REJECTED]: IAdminConsultantAiRejectedMetadata;
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
