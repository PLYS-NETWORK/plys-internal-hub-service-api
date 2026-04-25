import { ActivePlatform, UserRole } from '@database/enums';

export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: UserRole;
  readonly activePlatform: ActivePlatform;
  readonly sessionId: string;
  readonly deviceId: string | null;
  /** Issuer claim — set on every newly signed token. Optional for roll-forward;
   *  enforced when JWT_STRICT_CLAIMS=true. */
  readonly iss?: string;
  /** Audience claim — set on every newly signed token. Optional for roll-forward;
   *  enforced when JWT_STRICT_CLAIMS=true. */
  readonly aud?: string;
  readonly iat?: number;
  readonly exp?: number;
}
