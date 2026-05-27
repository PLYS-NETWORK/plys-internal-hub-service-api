export * from './business.events';
export * from './consultant.events';
export * from './payment.events';
export * from './project.events';
export * from './task.events';

export const NOTIFICATION_EVENTS = {
  BUSINESS_ONBOARDED: 'business.onboarded',
  PROJECT_PUBLISHED: 'project.published',
  PROJECT_UNPUBLISHED: 'project.unpublished',
  TASK_PUBLISHED: 'task.published',
  PAYMENT_TOP_UP_COMPLETED: 'payment.top_up.completed',
  PAYMENT_TOP_UP_REFUNDED: 'payment.top_up.refunded',
  PAYMENT_WITHDRAW_COMPLETED: 'payment.withdraw.completed',
  PAYMENT_WITHDRAW_REVERSED: 'payment.withdraw.reversed',
  CONSULTANT_PROJECT_JOINED: 'consultant.project.joined',
  CONSULTANT_PROJECT_LEFT: 'consultant.project.left',
  // Onboarding lifecycle
  CONSULTANT_ONBOARDING_SUBMITTED: 'consultant.onboarding.submitted',
  CONSULTANT_ONBOARDING_APPROVED: 'consultant.onboarding.approved',
  CONSULTANT_ONBOARDING_REJECTED: 'consultant.onboarding.rejected',
  // Skill-exam lifecycle
  CONSULTANT_SKILL_EXAM_SUBMITTED: 'consultant.skill_exam.submitted',
  CONSULTANT_SKILL_EXAM_FAILED: 'consultant.skill_exam.failed',
  CONSULTANT_SKILL_EXAM_PASSED: 'consultant.skill_exam.passed',
  CONSULTANT_ACCOUNT_BANNED: 'consultant.account.banned',
  TASK_STATUS_CHANGED: 'task.status.changed',
  // Fired when a task reviewer is auto-assigned (initial or arbiter slot).
  TASK_REVIEWER_REVIEW_ASSIGNED: 'task.reviewer.review_assigned',
  // Fired after a majority-PASS vote-resolution so the AI quality check runs
  // asynchronously and finalises DONE / REVISION_REQUESTED.
  TASK_AI_REVIEW_REQUESTED: 'task.ai_review.requested',
} as const;

export type NotificationEventName = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];
