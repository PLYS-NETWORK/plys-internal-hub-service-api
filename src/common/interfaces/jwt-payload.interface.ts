import { ActivePlatform, UserRole } from '@database/enums';

export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: UserRole;
  readonly activePlatform: ActivePlatform;
  readonly sessionId: string;
  readonly deviceId: string | null;
  /**
   * BusinessProfile id when activePlatform === BUSINESS. Optional so existing
   * non-business tokens (consultant, admin) verify unchanged. Tenant ownership
   * is double-checked in repositories — a tampered claim alone does not grant
   * cross-tenant read access.
   */
  readonly businessId?: string;
  /** Issuer claim — set on every newly signed token. Optional for roll-forward;
   *  enforced when JWT_STRICT_CLAIMS=true. */
  readonly iss?: string;
  /** Audience claim — set on every newly signed token. Optional for roll-forward;
   *  enforced when JWT_STRICT_CLAIMS=true. */
  readonly aud?: string;
  readonly iat?: number;
  readonly exp?: number;
}
