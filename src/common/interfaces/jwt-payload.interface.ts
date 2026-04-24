import { ActivePlatform, UserRole } from '@database/enums';

export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: UserRole;
  readonly activePlatform: ActivePlatform;
  readonly sessionId: string;
  readonly deviceId: string | null;
  readonly iat?: number;
  readonly exp?: number;
}
