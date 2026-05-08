import {
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_TYPES,
  NotificationType,
} from '../enums/notification-type.enum';
import {
  IPasswordChangedMetadata,
  IProfileUpdatedMetadata,
  IProjectPublishedMetadata,
  IProjectUnpublishedMetadata,
  ITopUpCompletedMetadata,
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
export interface INotificationTypeConfig<T extends NotificationType> {
  readonly entityType: string;
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
}) as ConfigMap;
