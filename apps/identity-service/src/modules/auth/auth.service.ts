import { Injectable } from '@nestjs/common';
import { ActivePlatform, SsoProvider } from '@plys/libraries/database/enums';

import {
  AuthResponseDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  UserResponseDto,
} from './dto';
import { IAuthService, ISessionContext, ISsoUserData } from './interfaces/auth-service.interface';
import { BasicAuthService } from './services/basic-auth.service';
import { SessionService } from './services/session.service';
import { SsoAuthService } from './services/sso-auth.service';

/**
 * AuthService is a thin Facade over the domain-specific sub-services.
 * It implements IAuthService so the controller depends on one stable injection
 * point and the module export surface stays unchanged.
 *
 * SRP: Each sub-service owns one cohesive concern.
 * OCP: Adding a new SSO provider = new ISsoTokenProvider file + module
 *      registration, no changes here or in SsoAuthService.
 */
@Injectable()
export class AuthService implements IAuthService {
  constructor(
    private readonly basicAuth: BasicAuthService,
    private readonly ssoAuth: SsoAuthService,
    private readonly session: SessionService,
  ) {}

  /** @inheritdoc */
  public register(dto: RegisterDto, context: ISessionContext): Promise<void> {
    return this.basicAuth.register(dto, context);
  }

  /** @inheritdoc */
  public verifyEmail(token: string, context: ISessionContext): Promise<AuthResponseDto> {
    return this.basicAuth.verifyEmail(token, context);
  }

  /** @inheritdoc */
  public resendVerification(dto: ResendVerificationDto): Promise<void> {
    return this.basicAuth.resendVerification(dto);
  }

  /** @inheritdoc */
  public login(dto: LoginDto, context: ISessionContext): Promise<AuthResponseDto> {
    return this.basicAuth.login(dto, context);
  }

  /** @inheritdoc */
  public changePassword(dto: ChangePasswordDto): Promise<void> {
    return this.basicAuth.changePassword(dto);
  }

  /** @inheritdoc */
  public requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    return this.basicAuth.requestPasswordReset(dto);
  }

  /** @inheritdoc */
  public resetPassword(dto: ResetPasswordDto): Promise<void> {
    return this.basicAuth.resetPassword(dto);
  }

  /** @inheritdoc */
  public refresh(refreshToken: string, context: ISessionContext): Promise<AuthResponseDto> {
    return this.session.refresh(refreshToken, context);
  }

  /** @inheritdoc */
  public logout(): Promise<void> {
    return this.session.logout();
  }

  /** @inheritdoc */
  public me(): Promise<UserResponseDto> {
    return this.session.me();
  }

  /** @inheritdoc */
  public ssoLogin(
    provider: string,
    userData: ISsoUserData,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto> {
    return this.ssoAuth.ssoLogin(provider, userData, activePlatform, context);
  }

  /** @inheritdoc */
  public verifyGoogleIdToken(idToken: string): Promise<ISsoUserData> {
    return this.ssoAuth.verifyProviderToken(SsoProvider.GOOGLE, idToken);
  }
}
