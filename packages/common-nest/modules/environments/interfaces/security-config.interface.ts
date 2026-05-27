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

  /**
   * Shared secret presented by trusted BFFs via the `x-api-key` header on
   * public marketplace endpoints (e.g. /api/v1/explore/*). Required at boot
   * via `getOrThrow`; the guard rejects requests when missing or mismatched.
   */
  readonly publicEndpointApiKey: string;

  /**
   * Shared secret the API gateway sends on every outbound gRPC call. Microservices
   * reject requests when the metadata token is missing or mismatched in dev/prod.
   */
  readonly grpcServiceSecret: string;
}
