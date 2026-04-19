/**
 * Machine-readable error codes included in every error response as `error_code`.
 * Clients use these for programmatic error handling independent of locale/language.
 *
 * Convention: SCREAMING_SNAKE_CASE, grouped by domain prefix.
 * Adding a new error:
 *   1. Add the constant here.
 *   2. Pass it as `errorCode` when throwing TranslatableException.
 *   3. Add the corresponding i18n key to src/i18n/en/error.json.
 */
export const ERROR_CODES = {
  // ─── Generic ──────────────────────────────────────────────────────────────
  GENERIC_BAD_REQUEST: 'GENERIC_BAD_REQUEST',
  GENERIC_UNAUTHORIZED: 'GENERIC_UNAUTHORIZED',
  GENERIC_FORBIDDEN: 'GENERIC_FORBIDDEN',
  GENERIC_NOT_FOUND: 'GENERIC_NOT_FOUND',
  GENERIC_CONFLICT: 'GENERIC_CONFLICT',
  GENERIC_UNPROCESSABLE: 'GENERIC_UNPROCESSABLE',
  GENERIC_INTERNAL_SERVER_ERROR: 'GENERIC_INTERNAL_SERVER_ERROR',
  GENERIC_VALIDATION_FAILED: 'GENERIC_VALIDATION_FAILED',

  // ─── Auth ─────────────────────────────────────────────────────────────────
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_ALREADY_USED: 'AUTH_TOKEN_ALREADY_USED',
  AUTH_DEVICE_MISMATCH: 'AUTH_DEVICE_MISMATCH',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_EMAIL_ALREADY_REGISTERED: 'AUTH_EMAIL_ALREADY_REGISTERED',
  AUTH_EMAIL_PENDING_VERIFICATION: 'AUTH_EMAIL_PENDING_VERIFICATION',
  AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
  AUTH_ACCOUNT_INACTIVE: 'AUTH_ACCOUNT_INACTIVE',

  // ─── Business Profile ────────────────────────────────────────────────────
  BUSINESS_PROFILE_ALREADY_EXISTS: 'BUSINESS_PROFILE_ALREADY_EXISTS',
  BUSINESS_PROFILE_NOT_FOUND: 'BUSINESS_PROFILE_NOT_FOUND',

  // ─── Database ─────────────────────────────────────────────────────────────
  DATABASE_UNIQUE_VIOLATION: 'DATABASE_UNIQUE_VIOLATION',
  DATABASE_FOREIGN_KEY_VIOLATION: 'DATABASE_FOREIGN_KEY_VIOLATION',
  DATABASE_NOT_NULL_VIOLATION: 'DATABASE_NOT_NULL_VIOLATION',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
