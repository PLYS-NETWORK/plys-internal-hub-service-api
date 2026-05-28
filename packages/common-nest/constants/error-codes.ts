import { DATABASE_ERROR_CODES, GENERIC_ERROR_CODES } from '@plys/libraries/shared-kernel';

import {
  AI_PROVIDER_KEY_ERROR_CODES,
  AUTH_ERROR_CODES,
  FILE_ERROR_CODES,
  GATEWAY_INFRA_ERROR_CODES,
} from './infra-error-codes';

/**
 * Cross-cutting codes for shared Nest infrastructure (guards, filters, file storage, gRPC helpers).
 * Domain-specific codes live in each service under `apps/<service>/src/errors/error-codes.ts`.
 */
export const ERROR_CODES = {
  ...GENERIC_ERROR_CODES,
  ...DATABASE_ERROR_CODES,
  ...AUTH_ERROR_CODES,
  ...FILE_ERROR_CODES,
  ...GATEWAY_INFRA_ERROR_CODES,
  ...AI_PROVIDER_KEY_ERROR_CODES,
} as const;

/** Any machine-readable error_code string returned by the API. */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | string;
