// Discriminator values used as the `type` field on every Notification row
// and on the `notification.new` Socket.IO payload. The FE switches on this
// to render per-type UI and to follow `redirect_url`. See
// src/modules/notifications/types/notification-metadata.types.ts for the
// per-type metadata contract that travels alongside.
export const NOTIFICATION_TYPES = {
  PROFILE_UPDATED: 'profile_updated',
  PASSWORD_CHANGED: 'password_changed',
  PROJECT_PUBLISHED: 'project_published',
  PROJECT_UNPUBLISHED: 'project_unpublished',
  NEW_APPLICATION: 'new_application',
  TOP_UP_COMPLETED: 'top_up_completed',
  WITHDRAW_COMPLETED: 'withdraw_completed',
  WITHDRAW_REVERSED: 'withdraw_reversed',
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// Generic entity-type tags. Used for a typed (entity_type, entity_id) pair
// the FE can route off when `redirect_url` is null.
export const NOTIFICATION_ENTITY_TYPES = {
  USER: 'user',
  PROJECT: 'project',
  APPLICATION: 'application',
  TRANSACTION: 'transaction',
} as const;

export type NotificationEntityType =
  (typeof NOTIFICATION_ENTITY_TYPES)[keyof typeof NOTIFICATION_ENTITY_TYPES];
