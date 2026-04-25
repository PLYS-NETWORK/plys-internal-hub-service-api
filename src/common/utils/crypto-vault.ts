// Application-level AES-256-GCM envelope encryption for column-level secrets
// (e.g. SSO provider tokens). Keeps all crypto behind a small, versioned API
// so the algorithm or KMS backing can be rotated without changing call sites.
//
// Envelope format: `v1:<iv_b64url>:<tag_b64url>:<ciphertext_b64url>`.
// The version prefix lets future rotations decrypt legacy envelopes while
// writing new ones in the next format.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 'v1';

let cachedKey: Buffer | null = null;

function loadKey(rawKey: string): Buffer {
  if (cachedKey) return cachedKey;
  if (!rawKey) {
    throw new Error(
      'SSO_TOKEN_ENCRYPTION_KEY is not configured. Generate one with: ' +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  const buf = Buffer.from(rawKey, 'base64');
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `SSO_TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${buf.length}). ` +
        'It must be a base64-encoded 32-byte value.',
    );
  }
  cachedKey = buf;
  return buf;
}

/** Resets the cached key — used by tests after mutating env. */
export function _resetCryptoVaultForTests(): void {
  cachedKey = null;
}

export class CryptoVault {
  /**
   * Encrypts the given plaintext under the configured key and returns a
   * versioned envelope safe to store in a `text` column.
   */
  public static encrypt(plaintext: string, rawKey: string): string {
    const key = loadKey(rawKey);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      VERSION,
      iv.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  /**
   * Decrypts a versioned envelope. Throws if the version is unknown, the tag
   * fails authentication, or the input is malformed.
   */
  public static decrypt(envelope: string, rawKey: string): string {
    const parts = envelope.split(':');
    if (parts.length !== 4) {
      throw new Error('CryptoVault.decrypt: malformed envelope');
    }
    const [version, ivB64, tagB64, ctB64] = parts;
    if (version !== VERSION) {
      throw new Error(`CryptoVault.decrypt: unsupported envelope version "${version}"`);
    }
    const key = loadKey(rawKey);
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const ct = Buffer.from(ctB64, 'base64url');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error('CryptoVault.decrypt: malformed envelope (bad iv/tag length)');
    }
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
    return plaintext.toString('utf8');
  }

  /** Cheap heuristic — used by transformer to skip already-plaintext rows. */
  public static isEnvelope(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.startsWith(`${VERSION}:`);
  }
}
