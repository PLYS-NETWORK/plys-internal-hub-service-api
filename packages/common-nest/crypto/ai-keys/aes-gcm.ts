import { HttpStatus } from '@nestjs/common';
import { AI_PROVIDER_KEY_ERROR_CODES } from '@plys/libraries/common-nest/constants/infra-error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { IAiKeysVersionedSecrets } from '@plys/libraries/common-nest/modules/environments/interfaces';
import { decodeAes256GcmKeyBase64 } from '@plys/libraries/config/secrets/validators';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Shared AES-256-GCM primitives for `MasterKeyCipher` and `BffEnvelopeCipher`.
//
// Both secret families use the same key material format (SecretType: aes_256_gcm_key_base64):
//   - `AI_KEYS_MASTER_KEY_v<N>` — encrypts keys at rest in the DB
//   - `FE_BFF_SECRET_v<N>`     — wraps the active-key response for the FE BFF
// Generate each independently: `openssl rand -base64 32` (exactly 32 decoded bytes).
// Do not use JWT-style secrets (`openssl rand -base64 48`) for these keys.
//
// `GcmCipher` receives separate `IAiKeysVersionedSecrets` configs (`app.aiKeys.master`
// vs `app.aiKeys.bff`); the `label` arg (`AI_KEYS_MASTER_KEY` / `FE_BFF_SECRET`) is
// only for error messages — validation rules are identical.

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

// Reason is logged via the GlobalExceptionFilter (HttpException's `cause`) but
// never surfaces in the user-facing payload — these failures are operator
// errors (bad env / corrupt ciphertext), not user-actionable.
export function failCipher(reason: string): never {
  const exception = new TranslatableException({
    messageKey: 'error.ai_provider_key.cipher_failed',
    errorCode: AI_PROVIDER_KEY_ERROR_CODES.AI_PROVIDER_KEY_CIPHER_FAILED,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  });
  (exception as Error & { cause?: unknown }).cause = new Error(reason);
  throw exception;
}

// Decodes a base64-encoded 32-byte key. Accepts standard base64 (`+`, `/`)
// and URL-safe base64 (`-`, `_`), with or without trailing `=` padding —
// 32 bytes is 43 base64 chars unpadded, 44 chars with one `=`. Refuses
// anything else so a malformed env var fails loudly at first use rather
// than producing garbled ciphertext later.
function decodeKey(rawB64: string, label: string): Buffer {
  try {
    return decodeAes256GcmKeyBase64(rawB64, label);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    failCipher(reason);
  }
}

// Resolves the encryption / decryption key for a given version, handling the
// versioned-config bookkeeping in one place.
function resolveKey(secrets: IAiKeysVersionedSecrets, version: number, label: string): Buffer {
  const raw = secrets.versions[version];
  if (typeof raw !== 'string') {
    failCipher(`${label}: version ${version} is not configured`);
  }
  return decodeKey(raw, `${label} v${version}`);
}

export interface IGcmEnvelope {
  /** Master / BFF key version that wraps `ciphertext`. */
  version: number;
  /** Initialisation vector, 12 bytes, base64. */
  iv: string;
  /** Authentication tag, 16 bytes, base64. */
  tag: string;
  /** Ciphertext, base64. */
  ciphertext: string;
}

export class GcmCipher {
  /**
   * Encrypts `plaintext` with the version flagged as current in `secrets`.
   * Returns a JSON-friendly envelope that records the version so a future
   * decrypt finds the right key.
   */
  public static encrypt(
    plaintext: string,
    secrets: IAiKeysVersionedSecrets,
    label: string,
  ): IGcmEnvelope {
    const version = secrets.currentVersion;
    if (!Number.isInteger(version) || version <= 0) {
      failCipher(`${label}: currentVersion must be a positive integer`);
    }
    const key = resolveKey(secrets, version, label);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      version,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ct.toString('base64'),
    };
  }

  /**
   * Decrypts `envelope` using the key matching `envelope.version`. Throws if
   * that version isn't configured or if the auth tag fails — both surface as
   * `AI_PROVIDER_KEY_CIPHER_FAILED` with no plaintext leakage.
   */
  public static decrypt(
    envelope: IGcmEnvelope,
    secrets: IAiKeysVersionedSecrets,
    label: string,
  ): string {
    const key = resolveKey(secrets, envelope.version, label);
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ct = Buffer.from(envelope.ciphertext, 'base64');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      failCipher(`${label}: envelope iv/tag length mismatch`);
    }
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
      return pt.toString('utf8');
    } catch {
      // Auth tag failure / corrupt ciphertext — mask the cause so callers
      // can't probe whether a particular byte sequence decrypts.
      failCipher(`${label}: decrypt failed`);
    }
  }
}
