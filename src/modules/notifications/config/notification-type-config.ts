import {
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_TYPES,
  NotificationType,
} from '../enums/notification-type.enum';
import {
  IAdminBusinessOnboardedMetadata,
  IAdminBusinessTopUpMetadata,
  IAdminConsultantAiRejectedMetadata,
  IAdminConsultantInterviewSubmittedMetadata,
  IAdminProjectPublishedMetadata,
  IAdminTaskPublishedMetadata,
  IConsultantProjectJoinedMetadata,
  IConsultantProjectSkillMatchMetadata,
  IConsultantTaskStatusChangedMetadata,
  IPasswordChangedMetadata,
  IProfileUpdatedMetadata,
  IProjectPublishedMetadata,
  IProjectUnpublishedMetadata,
  ITaskPublishedMetadata,
  ITopUpCompletedMetadata,
  ITopUpRefundedMetadata,
  IWithdrawCompletedMetadata,
  IWithdrawReversedMetadata,
  NotificationMetadataMap,
} from '../types/notification-metadata.types';

/**
 * Per-type config used by the dispatcher to resolve `entity_type`, `entity_id`,
 * `redirect_url`, and the i18n keys for `title` / `body`.
 *
 * `getRedirectUrl` receives the metadata, the BUSINESS frontend base URL, and
 * the recipient's `businessId` so the URL is deep-linked into the correct tenant.
 * Return `null` to skip the pre-computed URL — the FE then falls back to the
 * (entity_type, entity_id) pair.
 *
 * `getEntityId` receives the metadata and the recipient userId. User-scoped
 * notifications (profile/password) use the userId as entity_id so the FE has
 * a valid (entity_type='user', entity_id=<userId>) pair.
 */
/** Which base URL the dispatcher should pass into `getRedirectUrl`. */
export type NotificationBaseUrlKey = 'ployosUrl' | 'internalHubUrl' | 'lonaUrl';

export interface INotificationTypeConfig<T extends NotificationType> {
  readonly entityType: string;
  /**
   * Determines which `EnvironmentsService` URL getter is used as the
   * `frontendBaseUrl` argument for `getRedirectUrl`. Defaults to `'ployosUrl'`
   * when omitted (business / consultant platform).
   */
  readonly baseUrlKey?: NotificationBaseUrlKey;
  readonly getEntityId: (metadata: NotificationMetadataMap[T], userId: string) => string;
  readonly getRedirectUrl: (
    metadata: NotificationMetadataMap[T],
    frontendBaseUrl: string,
    businessId: string | null,
  ) => string | null;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly bodyArgs?: (metadata: NotificationMetadataMap[T]) => Record<string, string | number>;
}

type ConfigMap = {
  [K in NotificationType]: INotificationTypeConfig<K>;
};

// Frozen at module load — no per-call overhead.
export const NOTIFICATION_TYPE_CONFIG: ConfigMap = Object.freeze({
  // ── User / account ─────────────────────────────────────────────────────────
  [NOTIFICATION_TYPES.PROFILE_UPDATED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.USER,
    getEntityId: (_m: IProfileUpdatedMetadata, userId: string) => userId,
    getRedirectUrl: (_m, base, businessId) =>
      businessId ? `${base}/c/${businessId}/settings/profile` : `${base}/settings/profile`,
    titleKey: 'notification.profile_updated.title',
    bodyKey: 'notification.profile_updated.body',
    bodyArgs: (m: IProfileUpdatedMetadata) => ({
      fields: m.updated_fields.join(', '),
    }),
  },
  [NOTIFICATION_TYPES.PASSWORD_CHANGED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.USER,
    getEntityId: (_m: IPasswordChangedMetadata, userId: string) => userId,
    getRedirectUrl: (_m, base, businessId) =>
      businessId ? `${base}/c/${businessId}/settings/security` : `${base}/settings/security`,
    titleKey: 'notification.password_changed.title',
    bodyKey: 'notification.password_changed.body',
  },

  // ── Business: project & task ────────────────────────────────────────────────
  [NOTIFICATION_TYPES.PROJECT_PUBLISHED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.PROJECT,
    getEntityId: (m: IProjectPublishedMetadata) => m.project_id,
    getRedirectUrl: (m, base, businessId) =>
      businessId ? `${base}/c/${businessId}/projects/${m.project_id}` : null,
    titleKey: 'notification.project_published.title',
    bodyKey: 'notification.project_published.body',
    bodyArgs: (m: IProjectPublishedMetadata) => ({
      title: m.project_title,
      code: m.project_code,
    }),
  },
  [NOTIFICATION_TYPES.PROJECT_UNPUBLISHED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.PROJECT,
    getEntityId: (m: IProjectUnpublishedMetadata) => m.project_id,
    getRedirectUrl: (m, base, businessId) =>
      businessId ? `${base}/c/${businessId}/projects/${m.project_id}` : null,
    titleKey: 'notification.project_unpublished.title',
    bodyKey: 'notification.project_unpublished.body',
    bodyArgs: (m: IProjectUnpublishedMetadata) => ({
      title: m.project_title,
      code: m.project_code,
    }),
  },
  [NOTIFICATION_TYPES.TASK_PUBLISHED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.TASK,
    getEntityId: (m: ITaskPublishedMetadata) => m.task_id,
    getRedirectUrl: (m, base, businessId) =>
      businessId ? `${base}/c/${businessId}/projects/${m.project_id}/tasks/${m.task_id}` : null,
    titleKey: 'notification.task_published.title',
    bodyKey: 'notification.task_published.body',
    bodyArgs: (m: ITaskPublishedMetadata) => ({
      title: m.task_title,
      code: m.task_code,
    }),
  },

  // ── Business: finance ───────────────────────────────────────────────────────
  [NOTIFICATION_TYPES.TOP_UP_COMPLETED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.TRANSACTION,
    getEntityId: (m: ITopUpCompletedMetadata) => m.transaction_id,
    getRedirectUrl: (_m, base, businessId) =>
      businessId ? `${base}/c/${businessId}/billing/transactions` : null,
    titleKey: 'notification.top_up_completed.title',
    bodyKey: 'notification.top_up_completed.body',
    bodyArgs: (m: ITopUpCompletedMetadata) => ({
      amount: m.amount.toFixed(2),
      currency: m.currency,
    }),
  },
  [NOTIFICATION_TYPES.TOP_UP_REFUNDED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.TRANSACTION,
    getEntityId: (m: ITopUpRefundedMetadata) => m.transaction_id,
    getRedirectUrl: (_m, base, businessId) =>
      businessId ? `${base}/c/${businessId}/billing/transactions` : null,
    titleKey: 'notification.top_up_refunded.title',
    bodyKey: 'notification.top_up_refunded.body',
    bodyArgs: (m: ITopUpRefundedMetadata) => ({
      amount: m.amount.toFixed(2),
      currency: m.currency,
    }),
  },
  [NOTIFICATION_TYPES.WITHDRAW_COMPLETED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.TRANSACTION,
    getEntityId: (m: IWithdrawCompletedMetadata) => m.transaction_id,
    getRedirectUrl: (_m, base, businessId) =>
      businessId ? `${base}/c/${businessId}/billing/transactions` : null,
    titleKey: 'notification.withdraw_completed.title',
    bodyKey: 'notification.withdraw_completed.body',
    bodyArgs: (m: IWithdrawCompletedMetadata) => ({
      amount: m.amount.toFixed(2),
      currency: m.currency,
    }),
  },
  [NOTIFICATION_TYPES.WITHDRAW_REVERSED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.TRANSACTION,
    getEntityId: (m: IWithdrawReversedMetadata) => m.transaction_id,
    getRedirectUrl: (_m, base, businessId) =>
      businessId ? `${base}/c/${businessId}/billing/transactions` : null,
    titleKey: 'notification.withdraw_reversed.title',
    bodyKey: 'notification.withdraw_reversed.body',
    bodyArgs: (m: IWithdrawReversedMetadata) => ({
      amount: m.amount.toFixed(2),
      currency: m.currency,
      reason: m.reason,
    }),
  },

  // ── Consultant ──────────────────────────────────────────────────────────────
  [NOTIFICATION_TYPES.CONSULTANT_PROJECT_SKILL_MATCH]: {
    entityType: NOTIFICATION_ENTITY_TYPES.PROJECT,
    getEntityId: (m: IConsultantProjectSkillMatchMetadata) => m.project_id,
    getRedirectUrl: (m, base) => `${base}/projects/${m.project_id}`,
    titleKey: 'notification.consultant_project_skill_match.title',
    bodyKey: 'notification.consultant_project_skill_match.body',
    bodyArgs: (m: IConsultantProjectSkillMatchMetadata) => ({
      title: m.project_title,
      code: m.project_code,
    }),
  },
  [NOTIFICATION_TYPES.CONSULTANT_PROJECT_JOINED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.PROJECT,
    getEntityId: (m: IConsultantProjectJoinedMetadata) => m.project_id,
    getRedirectUrl: (m, base) => `${base}/projects/${m.project_id}`,
    titleKey: 'notification.consultant_project_joined.title',
    bodyKey: 'notification.consultant_project_joined.body',
    bodyArgs: (m: IConsultantProjectJoinedMetadata) => ({
      title: m.project_title,
      code: m.project_code,
    }),
  },
  [NOTIFICATION_TYPES.CONSULTANT_TASK_STATUS_CHANGED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.TASK,
    getEntityId: (m: IConsultantTaskStatusChangedMetadata) => m.task_id,
    getRedirectUrl: (m, base) => `${base}/projects/${m.project_id}/tasks/${m.task_id}`,
    titleKey: 'notification.consultant_task_status_changed.title',
    bodyKey: 'notification.consultant_task_status_changed.body',
    bodyArgs: (m: IConsultantTaskStatusChangedMetadata) => ({
      code: m.task_code,
      title: m.task_title,
      new_status: m.new_status,
    }),
  },

  // ── Admin ───────────────────────────────────────────────────────────────────
  [NOTIFICATION_TYPES.ADMIN_BUSINESS_ONBOARDED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.USER,
    baseUrlKey: 'internalHubUrl',
    getEntityId: (_m: IAdminBusinessOnboardedMetadata, userId: string) => userId,
    getRedirectUrl: (m, base) => `${base}/businesses/${m.business_id}`,
    titleKey: 'notification.admin_business_onboarded.title',
    bodyKey: 'notification.admin_business_onboarded.body',
    bodyArgs: (m: IAdminBusinessOnboardedMetadata) => ({
      name: m.business_name,
    }),
  },
  [NOTIFICATION_TYPES.ADMIN_PROJECT_PUBLISHED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.PROJECT,
    baseUrlKey: 'internalHubUrl',
    getEntityId: (m: IAdminProjectPublishedMetadata) => m.project_id,
    getRedirectUrl: (m, base) => `${base}/projects/${m.project_id}`,
    titleKey: 'notification.admin_project_published.title',
    bodyKey: 'notification.admin_project_published.body',
    bodyArgs: (m: IAdminProjectPublishedMetadata) => ({
      title: m.project_title,
      code: m.project_code,
      business: m.business_name,
    }),
  },
  [NOTIFICATION_TYPES.ADMIN_BUSINESS_TOP_UP]: {
    entityType: NOTIFICATION_ENTITY_TYPES.TRANSACTION,
    baseUrlKey: 'internalHubUrl',
    getEntityId: (m: IAdminBusinessTopUpMetadata) => m.transaction_id,
    getRedirectUrl: (m, base) => `${base}/businesses/${m.business_id}/transactions`,
    titleKey: 'notification.admin_business_top_up.title',
    bodyKey: 'notification.admin_business_top_up.body',
    bodyArgs: (m: IAdminBusinessTopUpMetadata) => ({
      business: m.business_name,
      amount: m.amount.toFixed(2),
      currency: m.currency,
    }),
  },
  [NOTIFICATION_TYPES.ADMIN_TASK_PUBLISHED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.TASK,
    baseUrlKey: 'internalHubUrl',
    getEntityId: (m: IAdminTaskPublishedMetadata) => m.task_id,
    getRedirectUrl: (m, base) => `${base}/projects/${m.project_id}/tasks/${m.task_id}`,
    titleKey: 'notification.admin_task_published.title',
    bodyKey: 'notification.admin_task_published.body',
    bodyArgs: (m: IAdminTaskPublishedMetadata) => ({
      code: m.task_code,
      title: m.task_title,
      project: m.project_code,
      business: m.business_name,
    }),
  },
  [NOTIFICATION_TYPES.ADMIN_CONSULTANT_INTERVIEW_SUBMITTED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.APPLICATION,
    baseUrlKey: 'internalHubUrl',
    getEntityId: (m: IAdminConsultantInterviewSubmittedMetadata) => m.application_id,
    getRedirectUrl: (m, base) => `${base}/consultant-applications/${m.application_id}`,
    titleKey: 'notification.admin_consultant_interview_submitted.title',
    bodyKey: 'notification.admin_consultant_interview_submitted.body',
    bodyArgs: (m: IAdminConsultantInterviewSubmittedMetadata) => ({
      name: m.consultant_name,
    }),
  },
  [NOTIFICATION_TYPES.ADMIN_CONSULTANT_AI_REJECTED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.APPLICATION,
    baseUrlKey: 'internalHubUrl',
    getEntityId: (m: IAdminConsultantAiRejectedMetadata) => m.application_id,
    getRedirectUrl: (m, base) => `${base}/consultant-applications/${m.application_id}`,
    titleKey: 'notification.admin_consultant_ai_rejected.title',
    bodyKey: 'notification.admin_consultant_ai_rejected.body',
    bodyArgs: (m: IAdminConsultantAiRejectedMetadata) => ({
      name: m.consultant_name,
    }),
  },
}) as ConfigMap;
