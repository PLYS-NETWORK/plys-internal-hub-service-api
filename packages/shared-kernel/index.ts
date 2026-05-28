/**
 * Cross-service kernel types and constants.
 */
export type { IMasterKeyCipher } from './crypto/master-key-cipher.interface';
export { MASTER_KEY_CIPHER } from './crypto/master-key-cipher.interface';
export type { IDatabaseEnv } from './database-env.interface';
export {
  DATABASE_ERROR_CODES,
  type DatabaseErrorCode,
  GENERIC_ERROR_CODES,
  type GenericErrorCode,
} from './errors/generic';
