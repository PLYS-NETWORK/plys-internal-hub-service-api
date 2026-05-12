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
  CONSULTANT_INTERVIEW_SUBMITTED: 'consultant.interview.submitted',
  CONSULTANT_APPLICATION_AI_REJECTED: 'consultant.application.ai_rejected',
  CONSULTANT_PROJECT_JOINED: 'consultant.project.joined',
  CONSULTANT_ONBOARDING_APPROVED: 'consultant.onboarding.approved',
  CONSULTANT_SKILL_EXAM_SUBMITTED: 'consultant.skill_exam.submitted',
  CONSULTANT_SKILL_EXAM_FAILED: 'consultant.skill_exam.failed',
  CONSULTANT_SKILL_EXAM_PASSED: 'consultant.skill_exam.passed',
  CONSULTANT_ACCOUNT_BANNED: 'consultant.account.banned',
  TASK_STATUS_CHANGED: 'task.status.changed',
} as const;

export type NotificationEventName = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];
