import { ActivePlatform, SsoProvider } from '@database/enums';
import { Injectable } from '@nestjs/common';

import {
  AuthResponseDto,
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
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

  public register(dto: RegisterDto, context: ISessionContext): Promise<void> {
    return this.basicAuth.register(dto, context);
  }

  public verifyEmail(token: string, context: ISessionContext): Promise<AuthResponseDto> {
    return this.basicAuth.verifyEmail(token, context);
  }

  public resendVerification(dto: ResendVerificationDto): Promise<void> {
    return this.basicAuth.resendVerification(dto);
  }

  public login(dto: LoginDto, context: ISessionContext): Promise<AuthResponseDto> {
    return this.basicAuth.login(dto, context);
  }

  public changePassword(dto: ChangePasswordDto): Promise<void> {
    return this.basicAuth.changePassword(dto);
  }

  public refresh(refreshToken: string, context: ISessionContext): Promise<AuthResponseDto> {
    return this.session.refresh(refreshToken, context);
  }

  public logout(): Promise<void> {
    return this.session.logout();
  }

  public me(): Promise<UserResponseDto> {
    return this.session.me();
  }

  public ssoLogin(
    provider: string,
    userData: ISsoUserData,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto> {
    return this.ssoAuth.ssoLogin(provider, userData, activePlatform, context);
  }

  public verifyGoogleIdToken(idToken: string): Promise<ISsoUserData> {
    return this.ssoAuth.verifyProviderToken(SsoProvider.GOOGLE, idToken);
  }
}
