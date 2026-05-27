/**
 * Cross-service kernel types and constants.
 * Error codes and domain enums remain in api-gateway until Phase 1+ extraction.
 */
export const GRPC_METADATA_KEYS = {
  REQUEST_ID: 'x-request-id',
  USER_ID: 'x-user-id',
  USER_ROLE: 'x-user-role',
  ACTIVE_PLATFORM: 'x-active-platform',
  LOCALE: 'x-locale',
} as const;

export type GrpcMetadataKey = (typeof GRPC_METADATA_KEYS)[keyof typeof GRPC_METADATA_KEYS];

export const COMPOSITE_TX_SCOPE = 'scope:composite-tx' as const;

export type { IMasterKeyCipher } from './crypto/master-key-cipher.interface';
export { MASTER_KEY_CIPHER } from './crypto/master-key-cipher.interface';
export type { IDatabaseEnv } from './database-env.interface';
export { FINANCE_ERROR_CODES } from './errors/finance';
export {
  DATABASE_ERROR_CODES,
  type DatabaseErrorCode,
  GENERIC_ERROR_CODES,
  type GenericErrorCode,
} from './errors/generic';
export { IDENTITY_ERROR_CODES } from './errors/identity';
export { PLATFORM_ERROR_CODES } from './errors/platform';
export { PROFILES_ERROR_CODES } from './errors/profiles';
export { PROJECTS_ERROR_CODES } from './errors/projects';
