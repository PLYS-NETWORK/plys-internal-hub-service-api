export interface JwtPayload {
  readonly sub: string;
  readonly email: string;
  readonly role: string;
  readonly deviceId: string | null;
  readonly iat?: number;
  readonly exp?: number;
}
