/**
 * Versioned AES-256-GCM secrets used by the AI provider key vault. Each
 * `versions` map is keyed by a small integer; the `currentVersion` selects
 * which one wraps new payloads. Any version present in the map can decrypt.
 */
export interface IAiKeysVersionedSecrets {
  /** Version used to encrypt new payloads. Must be a key of `versions`. */
  readonly currentVersion: number;
  /**
   * All versions known to this process. Strings are 32-byte values
   * encoded as base64 — 43 chars unpadded or 44 chars with `=` padding;
   * standard or URL-safe alphabet. Generate with `openssl rand -base64 32`.
   */
  readonly versions: Readonly<Record<number, string>>;
}

export interface IAiKeysConfig {
  /** Master keys that wrap `ai_provider_api_key.key_ciphertext` at rest. */
  readonly aiKeysMaster: IAiKeysVersionedSecrets;
  /** Secrets that wrap the BFF envelope on the GET /ai-provider-keys/active wire. */
  readonly aiKeysBff: IAiKeysVersionedSecrets;
}
