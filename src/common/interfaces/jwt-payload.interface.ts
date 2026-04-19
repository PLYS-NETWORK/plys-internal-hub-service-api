import { ActivePlatform } from '@database/enums/active-platform.enum';
import { UserRole } from '@database/enums/user-role.enum';

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
