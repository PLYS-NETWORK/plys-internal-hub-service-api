/** Cryptographic secret categories used for env validation. */
export enum SecretType {
  /** HS256 JWT signing key — opaque high-entropy string, ≥ 32 UTF-8 bytes. */
  JwtHmacSha256 = 'jwt_hmac_sha256',
  /** AES-256-GCM key — base64-encoded exactly 32 raw bytes. */
  Aes256GcmKeyBase64 = 'aes_256_gcm_key_base64',
}

export const SECRET_TYPE_DESCRIPTIONS: Record<SecretType, string> = {
  [SecretType.JwtHmacSha256]:
    'HS256 JWT signing secret — opaque, ≥ 32 bytes UTF-8 (generate: openssl rand -base64 48)',
  [SecretType.Aes256GcmKeyBase64]:
    'AES-256-GCM key — base64 of exactly 32 bytes (generate: openssl rand -base64 32)',
};
