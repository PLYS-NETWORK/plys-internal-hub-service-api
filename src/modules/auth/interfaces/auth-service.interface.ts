import { ActivePlatform } from '@database/enums/active-platform.enum';
import { SsoProvider } from '@database/enums/sso-provider.enum';
import {
  AuthResponseDto,
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  UserResponseDto,
} from '@modules/auth/dto';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';

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

// ─── Sub-service interfaces ───────────────────────────────────────────────────

export interface IBasicAuthService {
  register(dto: RegisterDto, context: ISessionContext): Promise<void>;
  verifyEmail(token: string, context: ISessionContext): Promise<AuthResponseDto>;
  resendVerification(dto: ResendVerificationDto): Promise<void>;
  login(dto: LoginDto, context: ISessionContext): Promise<AuthResponseDto>;
  changePassword(dto: ChangePasswordDto): Promise<void>;
}

export interface ISessionService {
  me(): Promise<UserResponseDto>;
  refresh(refreshToken: string, context: ISessionContext): Promise<AuthResponseDto>;
  logout(): Promise<void>;
  createSession(
    userId: string,
    email: string,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto>;
}

export interface ISsoAuthService {
  ssoLogin(
    provider: string,
    userData: ISsoUserData,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto>;
  verifyProviderToken(providerName: SsoProvider, idToken: string): Promise<ISsoUserData>;
}

export interface IUserOnboardingService {
  createInitialProfile(
    tx: IUnitOfWork,
    userId: string,
    dto: Pick<RegisterDto, 'active_platform' | 'company_name' | 'full_name'>,
  ): Promise<string>;
}

// ─── Facade interface (AuthService) ──────────────────────────────────────────

export interface IAuthService {
  register(dto: RegisterDto, context: ISessionContext): Promise<void>;
  verifyEmail(token: string, context: ISessionContext): Promise<AuthResponseDto>;
  resendVerification(dto: ResendVerificationDto): Promise<void>;
  login(dto: LoginDto, context: ISessionContext): Promise<AuthResponseDto>;
  refresh(refreshToken: string, context: ISessionContext): Promise<AuthResponseDto>;
  logout(): Promise<void>;
  me(): Promise<UserResponseDto>;
  changePassword(dto: ChangePasswordDto): Promise<void>;
  ssoLogin(
    provider: string,
    userData: ISsoUserData,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto>;
  verifyGoogleIdToken(idToken: string): Promise<ISsoUserData>;
}
