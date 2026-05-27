export interface IJwtConfig {
  /**
   * SecretType: jwt_hmac_sha256 — HS256 access-token signing key.
   * Opaque, ≥ 32 UTF-8 bytes. Generate: `openssl rand -base64 48`.
   * Must differ from `jwtRefreshSecret` in dev/prod.
   */
  readonly jwtAccessSecret: string;

  /**
   * Lifetime of an access token as a vercel/ms duration string (e.g. `'15m'`).
   * Short-lived by design — access tokens are stateless and cannot be revoked until expiry.
   */
  readonly jwtAccessExpiration: string;

  /** SecretType: jwt_hmac_sha256 — HS256 refresh-token signing key (separate from access). */
  readonly jwtRefreshSecret: string;

  /**
   * Lifetime of a refresh token as a vercel/ms duration string (e.g. `'7d'`).
   * On use, the old session is deleted and a new one is issued (single-use rotation).
   */
  readonly jwtRefreshExpiration: string;

  /** Issuer (`iss`) claim emitted on every JWT and asserted on verify. */
  readonly jwtIssuer: string;

  /** Audience (`aud`) claim emitted on every JWT and asserted on verify. */
  readonly jwtAudience: string;

  /**
   * When `true`, JWTs missing `iss`/`aud` are rejected. When `false`, they are
   * accepted to allow a roll-forward window after the deploy that introduces
   * the claims; flip to `true` once one access-token TTL has elapsed.
   */
  readonly jwtStrictClaims: boolean;
}
