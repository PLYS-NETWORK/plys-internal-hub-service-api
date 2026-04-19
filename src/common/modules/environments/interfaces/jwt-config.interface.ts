export interface IJwtConfig {
  /** HMAC-SHA256 secret used to sign access tokens. Must be kept out of version control. */
  readonly jwtAccessSecret: string;

  /**
   * Lifetime of an access token as a vercel/ms duration string (e.g. `'15m'`).
   * Short-lived by design — access tokens are stateless and cannot be revoked until expiry.
   */
  readonly jwtAccessExpiration: string;

  /** HMAC-SHA256 secret used to sign refresh tokens. Separate from access secret for independent rotation. */
  readonly jwtRefreshSecret: string;

  /**
   * Lifetime of a refresh token as a vercel/ms duration string (e.g. `'7d'`).
   * On use, the old session is deleted and a new one is issued (single-use rotation).
   */
  readonly jwtRefreshExpiration: string;
}
