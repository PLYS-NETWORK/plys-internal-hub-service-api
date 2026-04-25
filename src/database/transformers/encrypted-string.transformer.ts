import { CryptoVault } from '@common/utils/crypto-vault';
import { ValueTransformer } from 'typeorm';

// TypeORM column transformer that encrypts on write and decrypts on read.
//
// `to` (entity → DB): encrypts non-null plaintext values into `v1:...` envelopes.
// `from` (DB → entity): decrypts `v1:...` envelopes; passes plaintext through
// unchanged so legacy rows written before the migration keep working.
//
// Reads SSO_TOKEN_ENCRYPTION_KEY from process.env directly because TypeORM
// transformers are instantiated outside Nest's DI graph. The CryptoVault
// caches the key after first use so this is not repeated work.
export class EncryptedStringTransformer implements ValueTransformer {
  public to(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return CryptoVault.encrypt(value, process.env.SSO_TOKEN_ENCRYPTION_KEY ?? '');
  }

  public from(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    if (!CryptoVault.isEnvelope(value)) {
      // Legacy plaintext row — leave as-is so rotation doesn't double-decrypt.
      // Once the backfill has run, all rows should be envelopes.
      return value;
    }
    return CryptoVault.decrypt(value, process.env.SSO_TOKEN_ENCRYPTION_KEY ?? '');
  }
}

// Singleton — TypeORM compares transformers by reference, so reuse one instance.
export const encryptedStringTransformer = new EncryptedStringTransformer();
