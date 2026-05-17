import {
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_TYPES,
  NotificationType,
} from '../enums/notification-type.enum';
import {
  IAdminBusinessOnboardedMetadata,
  IAdminBusinessTopUpMetadata,
  IAdminConsultantBannedMetadata,
  IAdminConsultantOnboardingSubmittedMetadata,
  IAdminConsultantProjectJoinedMetadata,
  IAdminConsultantProjectLeftMetadata,
  IAdminProjectPublishedMetadata,
  IAdminSkillExamResultMetadata,
  IAdminTaskPublishedMetadata,
  IBusinessTaskStatusChangedMetadata,
  IConsultantAccountBannedMetadata,
  IConsultantOnboardingApprovedMetadata,
  IConsultantOnboardingRejectedMetadata,
  IConsultantProjectJoinedMetadata,
  IConsultantProjectSkillMatchMetadata,
  IConsultantSkillExamFailedMetadata,
  IConsultantSkillExamPassedMetadata,
  IConsultantSkillExamSubmittedMetadata,
  IConsultantTaskStatusChangedMetadata,
  IPasswordChangedMetadata,
  IProfileUpdatedMetadata,
  IProjectConsultantJoinedMetadata,
  IProjectConsultantLeftMetadata,
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

/**
 * i18n key resolver — either a static key or a function that picks the key
 * based on metadata. Used by FAILED / PASSED notifications where the copy
 * branches on `metadata.fail_reason` / `metadata.proficiency_level`.
 */
export type NotificationI18nKey<T extends NotificationType> =
  | string
  | ((metadata: NotificationMetadataMap[T]) => string);

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
  readonly titleKey: NotificationI18nKey<T>;
  readonly bodyKey: NotificationI18nKey<T>;
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
  [NOTIFICATION_TYPES.PROJECT_CONSULTANT_JOINED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.PROJECT,
    getEntityId: (m: IProjectConsultantJoinedMetadata) => m.project_id,
    getRedirectUrl: (m, base, businessId) =>
      businessId ? `${base}/c/${businessId}/projects/${m.project_id}/team` : null,
    titleKey: 'notification.project_consultant_joined.title',
    bodyKey: 'notification.project_consultant_joined.body',
    bodyArgs: (m: IProjectConsultantJoinedMetadata) => ({
      consultant: m.consultant_name,
      title: m.project_title,
      code: m.project_code,
    }),
  },
  [NOTIFICATION_TYPES.PROJECT_CONSULTANT_LEFT]: {
    entityType: NOTIFICATION_ENTITY_TYPES.PROJECT,
    getEntityId: (m: IProjectConsultantLeftMetadata) => m.project_id,
    getRedirectUrl: (m, base, businessId) =>
      businessId ? `${base}/c/${businessId}/projects/${m.project_id}/team` : null,
    titleKey: 'notification.project_consultant_left.title',
    bodyKey: 'notification.project_consultant_left.body',
    bodyArgs: (m: IProjectConsultantLeftMetadata) => ({
      consultant: m.consultant_name,
      title: m.project_title,
      code: m.project_code,
    }),
  },
  [NOTIFICATION_TYPES.BUSINESS_TASK_STATUS_CHANGED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.TASK,
    getEntityId: (m: IBusinessTaskStatusChangedMetadata) => m.task_id,
    getRedirectUrl: (m, base, businessId) =>
      businessId ? `${base}/c/${businessId}/projects/${m.project_id}/tasks/${m.task_id}` : null,
    titleKey: 'notification.business_task_status_changed.title',
    bodyKey: 'notification.business_task_status_changed.body',
    bodyArgs: (m: IBusinessTaskStatusChangedMetadata) => ({
      code: m.task_code,
      title: m.task_title,
      new_status: m.new_status,
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
  [NOTIFICATION_TYPES.CONSULTANT_ONBOARDING_APPROVED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.ONBOARDING,
    getEntityId: (m: IConsultantOnboardingApprovedMetadata) => m.onboarding_id,
    getRedirectUrl: (_m, base) => `${base}/skill-exams`,
    titleKey: 'notification.consultant_onboarding_approved.title',
    bodyKey: 'notification.consultant_onboarding_approved.body',
  },
  [NOTIFICATION_TYPES.CONSULTANT_ONBOARDING_REJECTED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.ONBOARDING,
    getEntityId: (m: IConsultantOnboardingRejectedMetadata) => m.onboarding_id,
    // Rejected consultants cannot log back in for 3 months — `redirect_url` points to the public
    // landing page where they can re-onboard once the block lifts.
    getRedirectUrl: (_m, base) => `${base}/onboarding/blocked`,
    titleKey: 'notification.consultant_onboarding_rejected.title',
    bodyKey: 'notification.consultant_onboarding_rejected.body',
    bodyArgs: (m: IConsultantOnboardingRejectedMetadata) => ({
      blocked_until: m.blocked_until,
      reason: m.rejection_note ?? '',
    }),
  },
  [NOTIFICATION_TYPES.CONSULTANT_SKILL_EXAM_SUBMITTED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.SKILL_EXAM,
    getEntityId: (m: IConsultantSkillExamSubmittedMetadata) => m.exam_id,
    getRedirectUrl: (m, base) => `${base}/skill-exams/${m.exam_id}`,
    titleKey: 'notification.consultant_skill_exam_submitted.title',
    bodyKey: 'notification.consultant_skill_exam_submitted.body',
    bodyArgs: (m: IConsultantSkillExamSubmittedMetadata) => ({ skill: m.skill_name }),
  },
  // Dynamic title/body — dispatcher resolves the function against metadata so
  // a single notification row renders LOW_SCORE / COPYLEAKS_FAILED / EXPIRED copy
  // without splitting into separate NotificationType values.
  [NOTIFICATION_TYPES.CONSULTANT_SKILL_EXAM_FAILED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.SKILL_EXAM,
    getEntityId: (m: IConsultantSkillExamFailedMetadata) => m.exam_id,
    getRedirectUrl: (m, base) => `${base}/skill-exams/${m.exam_id}`,
    titleKey: (m: IConsultantSkillExamFailedMetadata) => {
      if (m.fail_reason === 'EXPIRED')
        return 'notification.consultant_skill_exam_failed.expired.title';
      if (m.fail_reason === 'COPYLEAKS_FAILED')
        return 'notification.consultant_skill_exam_failed.copyleaks.title';
      return 'notification.consultant_skill_exam_failed.low_score.title';
    },
    bodyKey: (m: IConsultantSkillExamFailedMetadata) => {
      if (m.fail_reason === 'EXPIRED')
        return 'notification.consultant_skill_exam_failed.expired.body';
      if (m.fail_reason === 'COPYLEAKS_FAILED')
        return 'notification.consultant_skill_exam_failed.copyleaks.body';
      return 'notification.consultant_skill_exam_failed.low_score.body';
    },
    bodyArgs: (m: IConsultantSkillExamFailedMetadata) => ({
      skill: m.skill_name,
      final_score: m.final_score.toFixed(2),
      // i18n cannot interpolate null — render an empty placeholder for EXPIRED.
      cooldown_until: m.cooldown_until ?? '',
      strikes_remaining: m.strikes_remaining,
    }),
  },
  [NOTIFICATION_TYPES.CONSULTANT_SKILL_EXAM_PASSED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.SKILL_EXAM,
    getEntityId: (m: IConsultantSkillExamPassedMetadata) => m.exam_id,
    getRedirectUrl: (_m, base) => `${base}/skills`,
    titleKey: (m: IConsultantSkillExamPassedMetadata) =>
      m.proficiency_level === 'expert'
        ? 'notification.consultant_skill_exam_passed.expert.title'
        : 'notification.consultant_skill_exam_passed.senior.title',
    bodyKey: (m: IConsultantSkillExamPassedMetadata) =>
      m.proficiency_level === 'expert'
        ? 'notification.consultant_skill_exam_passed.expert.body'
        : 'notification.consultant_skill_exam_passed.senior.body',
    bodyArgs: (m: IConsultantSkillExamPassedMetadata) => ({
      skill: m.skill_name,
      final_score: m.final_score.toFixed(2),
    }),
  },
  [NOTIFICATION_TYPES.CONSULTANT_ACCOUNT_BANNED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.USER,
    getEntityId: (_m: IConsultantAccountBannedMetadata, userId: string) => userId,
    getRedirectUrl: () => null,
    titleKey: 'notification.consultant_account_banned.title',
    bodyKey: 'notification.consultant_account_banned.body',
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
  [NOTIFICATION_TYPES.ADMIN_CONSULTANT_ONBOARDING_SUBMITTED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.ONBOARDING,
    baseUrlKey: 'internalHubUrl',
    getEntityId: (m: IAdminConsultantOnboardingSubmittedMetadata) => m.onboarding_id,
    // Deep-links to the admin review screen for this consultant's pending interview.
    getRedirectUrl: (m, base) => `${base}/consultant-onboardings/${m.onboarding_id}`,
    titleKey: 'notification.admin_consultant_onboarding_submitted.title',
    bodyKey: 'notification.admin_consultant_onboarding_submitted.body',
    bodyArgs: (m: IAdminConsultantOnboardingSubmittedMetadata) => ({
      name: m.consultant_name,
    }),
  },
  [NOTIFICATION_TYPES.ADMIN_SKILL_EXAM_RESULT]: {
    entityType: NOTIFICATION_ENTITY_TYPES.SKILL_EXAM,
    baseUrlKey: 'internalHubUrl',
    getEntityId: (m: IAdminSkillExamResultMetadata) => m.exam_id,
    getRedirectUrl: (m, base) => `${base}/skill-exams/${m.exam_id}`,
    // PASSED vs FAILED variants pick different copy so admin inboxes read like a verdict log.
    titleKey: (m: IAdminSkillExamResultMetadata) =>
      m.outcome === 'PASSED'
        ? 'notification.admin_skill_exam_result.passed.title'
        : `notification.admin_skill_exam_result.failed.title`,
    bodyKey: (m: IAdminSkillExamResultMetadata) =>
      m.outcome === 'PASSED'
        ? 'notification.admin_skill_exam_result.passed.body'
        : `notification.admin_skill_exam_result.failed.body`,
    bodyArgs: (m: IAdminSkillExamResultMetadata) => ({
      consultant: m.consultant_name,
      skill: m.skill_name,
      score: m.final_score.toFixed(2),
      outcome: m.outcome,
    }),
  },
  [NOTIFICATION_TYPES.ADMIN_CONSULTANT_BANNED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.USER,
    baseUrlKey: 'internalHubUrl',
    getEntityId: (m: IAdminConsultantBannedMetadata) => m.consultant_user_id,
    getRedirectUrl: (m, base) => `${base}/users/${m.consultant_user_id}`,
    titleKey: 'notification.admin_consultant_banned.title',
    bodyKey: 'notification.admin_consultant_banned.body',
    bodyArgs: (m: IAdminConsultantBannedMetadata) => ({
      consultant: m.consultant_name,
      reason: m.ban_reason,
      strikes: m.ai_strike_count,
    }),
  },
  [NOTIFICATION_TYPES.ADMIN_CONSULTANT_PROJECT_JOINED]: {
    entityType: NOTIFICATION_ENTITY_TYPES.PROJECT,
    baseUrlKey: 'internalHubUrl',
    getEntityId: (m: IAdminConsultantProjectJoinedMetadata) => m.project_id,
    getRedirectUrl: (m, base) => `${base}/projects/${m.project_id}`,
    titleKey: 'notification.admin_consultant_project_joined.title',
    bodyKey: 'notification.admin_consultant_project_joined.body',
    bodyArgs: (m: IAdminConsultantProjectJoinedMetadata) => ({
      consultant: m.consultant_name,
      title: m.project_title,
      code: m.project_code,
      business: m.business_name,
    }),
  },
  [NOTIFICATION_TYPES.ADMIN_CONSULTANT_PROJECT_LEFT]: {
    entityType: NOTIFICATION_ENTITY_TYPES.PROJECT,
    baseUrlKey: 'internalHubUrl',
    getEntityId: (m: IAdminConsultantProjectLeftMetadata) => m.project_id,
    getRedirectUrl: (m, base) => `${base}/projects/${m.project_id}`,
    titleKey: 'notification.admin_consultant_project_left.title',
    bodyKey: 'notification.admin_consultant_project_left.body',
    bodyArgs: (m: IAdminConsultantProjectLeftMetadata) => ({
      consultant: m.consultant_name,
      title: m.project_title,
      code: m.project_code,
      business: m.business_name,
    }),
  },
}) as ConfigMap;
