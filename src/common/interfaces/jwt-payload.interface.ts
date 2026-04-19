import { ActivePlatform } from '../../database/enums/active-platform.enum';

export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: string;
  readonly activePlatform: ActivePlatform;
  readonly sessionId: string;
  readonly deviceId: string | null;
  readonly iat?: number;
  readonly exp?: number;
}
