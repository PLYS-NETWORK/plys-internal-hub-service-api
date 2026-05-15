// Discriminator values used as the `type` field on every Notification row
// and on the `notification.new` Socket.IO payload. The FE switches on this
// to render per-type UI and to follow `redirect_url`. See
// src/modules/notifications/types/notification-metadata.types.ts for the
// per-type metadata contract that travels alongside.
export const NOTIFICATION_TYPES = {
  // ── User / account ─────────────────────────────────────────────────────────
  PROFILE_UPDATED: 'profile_updated',
  PASSWORD_CHANGED: 'password_changed',

  // ── Business: project & task ────────────────────────────────────────────────
  PROJECT_PUBLISHED: 'project_published',
  PROJECT_UNPUBLISHED: 'project_unpublished',
  TASK_PUBLISHED: 'task_published',

  // ── Business: finance ───────────────────────────────────────────────────────
  TOP_UP_COMPLETED: 'top_up_completed',
  TOP_UP_REFUNDED: 'top_up_refunded',
  WITHDRAW_COMPLETED: 'withdraw_completed',
  WITHDRAW_REVERSED: 'withdraw_reversed',

  // ── Consultant ──────────────────────────────────────────────────────────────
  CONSULTANT_PROJECT_SKILL_MATCH: 'consultant_project_skill_match',
  CONSULTANT_PROJECT_JOINED: 'consultant_project_joined',
  CONSULTANT_TASK_STATUS_CHANGED: 'consultant_task_status_changed',
  CONSULTANT_ONBOARDING_APPROVED: 'consultant_onboarding_approved',
  // Onboarding rejected — paired with the rejection email; 3-month block in effect.
  CONSULTANT_ONBOARDING_REJECTED: 'consultant_onboarding_rejected',
  CONSULTANT_SKILL_EXAM_SUBMITTED: 'consultant_skill_exam_submitted',
  CONSULTANT_SKILL_EXAM_FAILED: 'consultant_skill_exam_failed',
  CONSULTANT_SKILL_EXAM_PASSED: 'consultant_skill_exam_passed',
  CONSULTANT_ACCOUNT_BANNED: 'consultant_account_banned',

  // ── Admin (broadcast to all active admins) ──────────────────────────────────
  ADMIN_BUSINESS_ONBOARDED: 'admin_business_onboarded',
  ADMIN_PROJECT_PUBLISHED: 'admin_project_published',
  ADMIN_BUSINESS_TOP_UP: 'admin_business_top_up',
  ADMIN_TASK_PUBLISHED: 'admin_task_published',
  // Fan-out when a consultant finalises the onboarding interview — admin review queue.
  ADMIN_CONSULTANT_ONBOARDING_SUBMITTED: 'admin_consultant_onboarding_submitted',
  // Fan-out for every terminal skill-exam transition (PASSED / FAILED / EXPIRED / COPYLEAKS_FAILED).
  ADMIN_SKILL_EXAM_RESULT: 'admin_skill_exam_result',
  // Fan-out when a consultant hits the 3-strike CopyLeaks ban.
  ADMIN_CONSULTANT_BANNED: 'admin_consultant_banned',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// Generic entity-type tags. Used for a typed (entity_type, entity_id) pair
// the FE can route off when `redirect_url` is null.
export const NOTIFICATION_ENTITY_TYPES = {
  USER: 'user',
  PROJECT: 'project',
  TASK: 'task',
  TRANSACTION: 'transaction',
  APPLICATION: 'application',
  ONBOARDING: 'onboarding',
  SKILL_EXAM: 'skill_exam',
} as const;

export type NotificationEntityType =
  (typeof NOTIFICATION_ENTITY_TYPES)[keyof typeof NOTIFICATION_ENTITY_TYPES];
