import { DATABASE_ERROR_CODES, GENERIC_ERROR_CODES } from '@plys/libraries/shared-kernel';

export const NOTIFICATIONS_ERROR_CODES = {
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  NOTIFICATION_FORBIDDEN: 'NOTIFICATION_FORBIDDEN',
} as const;

export const ERROR_CODES = {
  ...GENERIC_ERROR_CODES,
  ...DATABASE_ERROR_CODES,
  ...NOTIFICATIONS_ERROR_CODES,
} as const;

export type NotificationsErrorCode =
  (typeof NOTIFICATIONS_ERROR_CODES)[keyof typeof NOTIFICATIONS_ERROR_CODES];
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
