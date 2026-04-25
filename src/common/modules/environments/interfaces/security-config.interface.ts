/**
 * Security knobs for auth hardening: column encryption key, SSO exchange code
 * lifetime, account-lockout window, throttler key prefix.
 */
export interface ISecurityConfig {
  /**
   * Base64-encoded 32-byte AES-256 key used to encrypt SSO provider tokens
   * at rest. Must be present in production.
   */
  readonly ssoTokenEncryptionKey: string;

  /** Lifetime (seconds) of a single-use SSO exchange code. */
  readonly ssoExchangeCodeTtlSeconds: number;

  /** Number of failed logins per user that triggers a lockout. */
  readonly loginLockoutThreshold: number;

  /** Lockout / failure-counter window in minutes. */
  readonly loginLockoutWindowMin: number;

  /** Prefix for throttler counter keys (namespaces shared Redis). */
  readonly throttleRedisPrefix: string;
}
