import { ActivePlatform } from '@database/enums/active-platform.enum';
import { AuthResponseDto, ChangePasswordDto, LoginDto, RegisterDto, UserResponseDto } from '@modules/auth/dto';

export interface ISessionContext {
  readonly ipAddress: string;
  readonly userAgent: string | null;
  readonly deviceId: string | null;
  readonly fingerprint: string | null;
}

export interface ISsoUserData {
  readonly providerUserId: string;
  readonly email: string;
  readonly displayName: string;
  readonly accessToken: string;
  readonly refreshToken: string | undefined;
}

export interface IAuthService {
  register(dto: RegisterDto, context: ISessionContext): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  login(dto: LoginDto, context: ISessionContext): Promise<AuthResponseDto>;
  refresh(refreshToken: string, context: ISessionContext): Promise<AuthResponseDto>;
  logout(sessionId: string): Promise<void>;
  me(userId: string): Promise<UserResponseDto>;
  changePassword(userId: string, dto: ChangePasswordDto, currentSessionId: string): Promise<void>;
  ssoLogin(
    provider: string,
    userData: ISsoUserData,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto>;
}
