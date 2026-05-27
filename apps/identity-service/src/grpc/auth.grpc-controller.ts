import { Metadata } from '@grpc/grpc-js';
import { AuthService } from '@modules/auth/auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SsoExchangeDto,
  SsoTokenDto,
  VerifyEmailDto,
} from '@modules/auth/dto';
import { ISessionContext } from '@modules/auth/interfaces/auth-service.interface';
import { OAuthStateStore } from '@modules/auth/services/oauth-state-store.service';
import { SsoCodeStore } from '@modules/auth/services/sso-code-store.service';
import { GoogleProfile } from '@modules/auth/strategies/google.strategy';
import { Controller, HttpStatus } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  buildRedirectResponse,
  buildSuccessResponse,
  GrpcBridgeBase,
  IHttpRequest,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ActivePlatform, SsoProvider } from '@plys/libraries/database/enums';

@Controller()
export class AuthGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    (req: IHttpRequest) => ReturnType<GrpcBridgeBase['dispatch']>
  > = {
    register: (req: IHttpRequest) => this.register(req),
    verifyEmail: (req: IHttpRequest) => this.verifyEmail(req),
    resendVerification: (req: IHttpRequest) => this.resendVerification(req),
    login: (req: IHttpRequest) => this.login(req),
    refresh: (req: IHttpRequest) => this.refresh(req),
    logout: () => this.logout(),
    me: () => this.me(),
    changePassword: (req: IHttpRequest) => this.changePassword(req),
    forgotPassword: (req: IHttpRequest) => this.forgotPassword(req),
    resetPassword: (req: IHttpRequest) => this.resetPassword(req),
    ssoGoogleCallback: (req: IHttpRequest) => this.ssoGoogleCallback(req),
    ssoExchange: (req: IHttpRequest) => this.ssoExchange(req),
    ssoGoogleToken: (req: IHttpRequest) => this.ssoGoogleToken(req),
  };

  constructor(
    requestContext: RequestContextService,
    private readonly authService: AuthService,
    private readonly ssoCodeStore: SsoCodeStore,
    private readonly oauthStateStore: OAuthStateStore,
    private readonly env: EnvironmentsService,
  ) {
    super(requestContext);
  }

  @GrpcMethod('Auth', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }

  private async register(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const dto = await this.parseAndValidateBody(request, RegisterDto);
    const context = this.buildSessionContext(request);
    await this.authService.register(dto, context);
    return buildSuccessResponse({ messageKey: 'success.created', data: null }, HttpStatus.CREATED);
  }

  private async verifyEmail(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const dto = this.parseJsonBody<VerifyEmailDto>(request);
    const context = this.buildSessionContext(request);
    const data = await this.authService.verifyEmail(dto.token, context);
    return buildSuccessResponse({ messageKey: 'success.ok', data });
  }

  private async resendVerification(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const dto = this.parseJsonBody<ResendVerificationDto>(request);
    await this.authService.resendVerification(dto);
    return buildSuccessResponse({ messageKey: 'success.verification_resent', data: null });
  }

  private async login(request: Parameters<GrpcBridgeBase['dispatch']>[0]): Promise<IHttpResponse> {
    const dto = await this.parseAndValidateBody(request, LoginDto);
    const context = this.buildSessionContext(request);
    const data = await this.authService.login(dto, context);
    return buildSuccessResponse({ messageKey: 'success.ok', data });
  }

  private async refresh(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const dto = this.parseJsonBody<RefreshTokenDto>(request);
    const context = this.buildSessionContext(request);
    const data = await this.authService.refresh(dto.refresh_token, context);
    return buildSuccessResponse({ messageKey: 'success.ok', data });
  }

  private async logout(): Promise<IHttpResponse> {
    await this.authService.logout();
    return buildSuccessResponse({ messageKey: 'success.ok', data: null });
  }

  private async me(): Promise<IHttpResponse> {
    const data = await this.authService.me();
    return buildSuccessResponse({ messageKey: 'success.ok', data });
  }

  private async changePassword(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const dto = this.parseJsonBody<ChangePasswordDto>(request);
    await this.authService.changePassword(dto);
    return buildSuccessResponse({ messageKey: 'success.ok', data: null });
  }

  private async forgotPassword(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const dto = this.parseJsonBody<ForgotPasswordDto>(request);
    await this.authService.requestPasswordReset(dto);
    return buildSuccessResponse({ messageKey: 'success.ok', data: null });
  }

  private async resetPassword(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const dto = this.parseJsonBody<ResetPasswordDto>(request);
    await this.authService.resetPassword(dto);
    return buildSuccessResponse({ messageKey: 'success.ok', data: null });
  }

  private async ssoGoogleCallback(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const body = this.parseJsonBody<{
      googleProfile: GoogleProfile;
      queryState: string;
    }>(request);
    const context = this.buildSessionContext(request);
    const stateRecord = await this.oauthStateStore.consume(body.queryState ?? '');
    const data = await this.authService.ssoLogin(
      SsoProvider.GOOGLE,
      body.googleProfile,
      stateRecord.activePlatform,
      context,
    );
    const code = await this.ssoCodeStore.issue(data);
    const baseUrl =
      stateRecord.activePlatform === ActivePlatform.CONSULTANT
        ? this.env.lonaosUrl
        : this.env.ployosUrl;
    const redirectUrl = new URL('/auth/sso/callback', baseUrl);
    redirectUrl.searchParams.set('code', code);
    return buildRedirectResponse(redirectUrl.toString());
  }

  private async ssoExchange(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const dto = this.parseJsonBody<SsoExchangeDto>(request);
    const data = await this.ssoCodeStore.consume(dto.code);
    return buildSuccessResponse({ messageKey: 'success.ok', data });
  }

  private async ssoGoogleToken(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
  ): Promise<IHttpResponse> {
    const dto = this.parseJsonBody<SsoTokenDto>(request);
    const context = this.buildSessionContext(request);
    const userData = await this.authService.verifyGoogleIdToken(dto.id_token);
    const data = await this.authService.ssoLogin(
      SsoProvider.GOOGLE,
      userData,
      dto.active_platform,
      context,
    );
    return buildSuccessResponse({ messageKey: 'success.ok', data });
  }

  private buildSessionContext(request: Parameters<GrpcBridgeBase['dispatch']>[0]): ISessionContext {
    return {
      ipAddress: this.requestContext.ipAddress,
      userAgent: this.requestContext.userAgent,
      deviceId: request.queryParams?.deviceId ?? this.requestContext.deviceId,
      fingerprint: request.queryParams?.fingerprint ?? null,
    };
  }
}
