import {
  DATABASE_ERROR_CODES,
  FINANCE_ERROR_CODES,
  GENERIC_ERROR_CODES,
  IDENTITY_ERROR_CODES,
  PLATFORM_ERROR_CODES,
  PROFILES_ERROR_CODES,
  PROJECTS_ERROR_CODES,
} from '@plys/libraries/shared-kernel';

/**
 * Machine-readable error codes included in every error response as `error_code`.
 * Merged from shared-kernel generic/database codes and per-domain service codes.
 */
export const ERROR_CODES = {
  ...GENERIC_ERROR_CODES,
  ...DATABASE_ERROR_CODES,
  ...IDENTITY_ERROR_CODES,
  ...PROFILES_ERROR_CODES,
  ...PROJECTS_ERROR_CODES,
  ...FINANCE_ERROR_CODES,
  ...PLATFORM_ERROR_CODES,
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
