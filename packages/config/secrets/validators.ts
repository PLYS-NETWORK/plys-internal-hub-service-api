import { PLACEHOLDER_SECRETS } from './env-secret-registry';

const JWT_MIN_BYTES = 32;
const AES_KEY_BYTES = 32;

export interface ISecretValidationIssue {
  readonly envVar: string;
  readonly message: string;
}

export interface ISecretValidationWarning {
  readonly envVar: string;
  readonly message: string;
}

/** Decodes a base64 AES-256 key or throws with a descriptive message. */
export function decodeAes256GcmKeyBase64(rawB64: string, label: string): Buffer {
  if (typeof rawB64 !== 'string' || rawB64.length === 0) {
    throw new Error(`${label}: missing key material`);
  }
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(rawB64)) {
    throw new Error(
      `${label}: must be a base64-encoded 32-byte value ` +
        `(generate with: openssl rand -base64 32)`,
    );
  }
  const buf = Buffer.from(rawB64, 'base64');
  if (buf.length !== AES_KEY_BYTES) {
    throw new Error(
      `${label}: decoded to ${buf.length} bytes, expected ${AES_KEY_BYTES} ` +
        `(generate with: openssl rand -base64 32)`,
    );
  }
  return buf;
}

export function validateAes256GcmKeyBase64(
  rawB64: string,
  label: string,
): ISecretValidationIssue | null {
  try {
    decodeAes256GcmKeyBase64(rawB64, label);
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { envVar: label, message };
  }
}

export function validateJwtHmacSecret(
  value: string,
  envVar: string,
  strict: boolean,
): { issue: ISecretValidationIssue | null; warning: ISecretValidationWarning | null } {
  if (value.length === 0) {
    return {
      issue: { envVar, message: 'must not be empty' },
      warning: null,
    };
  }

  const byteLength = Buffer.byteLength(value, 'utf8');

  if (strict) {
    if (PLACEHOLDER_SECRETS.has(value.toLowerCase())) {
      return {
        issue: {
          envVar,
          message: 'placeholder value is not allowed in dev/prod — use openssl rand -base64 48',
        },
        warning: null,
      };
    }
    if (byteLength < JWT_MIN_BYTES) {
      return {
        issue: {
          envVar,
          message: `must be at least ${JWT_MIN_BYTES} UTF-8 bytes (got ${byteLength})`,
        },
        warning: null,
      };
    }
    return { issue: null, warning: null };
  }

  if (byteLength < JWT_MIN_BYTES || PLACEHOLDER_SECRETS.has(value.toLowerCase())) {
    return {
      issue: null,
      warning: {
        envVar,
        message:
          'weak or placeholder value — acceptable for DEPLOY_ENV=local only; ' +
          'use openssl rand -base64 48 before deploying',
      },
    };
  }

  return { issue: null, warning: null };
}
