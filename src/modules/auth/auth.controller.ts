import { HEADERS } from '@common/constants';
import { Public } from '@common/decorators/public.decorator';
import { PublicEndpointApiKeyGuard } from '@common/guards/public-endpoint-api-key.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { EnvironmentsService } from '@common/modules/environments';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ActivePlatform, SsoProvider } from '@database/enums';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';

import { AuthService } from './auth.service';
import {
  AuthResponseDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SsoExchangeDto,
  SsoTokenDto,
  UserResponseDto,
  VerifyEmailDto,
} from './dto';
import { GoogleCallbackGuard } from './guards/google-callback.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { ISessionContext } from './interfaces/auth-service.interface';
import { OAuthStateStore } from './services/oauth-state-store.service';
import { SsoCodeStore } from './services/sso-code-store.service';
import { GoogleProfile } from './strategies/google.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly requestContext: RequestContextService,
    private readonly ssoCodeStore: SsoCodeStore,
    private readonly oauthStateStore: OAuthStateStore,
    private readonly env: EnvironmentsService,
  ) {}

  // ─── Email / Password ────────────────────────────────────────────────────

  @Public()
  @UseGuards(PublicEndpointApiKeyGuard)
  @ApiSecurity('x-api-key')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user with email/password',
    description:
      'Public endpoint gated by the BFF shared secret (`x-api-key`). Caller must be a trusted first-party frontend; direct browser calls are rejected.',
  })
  @ApiHeader({
    name: HEADERS.X_API_KEY,
    required: true,
    description: 'BFF shared secret. Compared with timingSafeEqual.',
  })
  @ApiHeader({
    name: HEADERS.X_DEVICE_ID,
    required: false,
    description: 'Unique device identifier for session binding',
  })
  @ApiHeader({
    name: HEADERS.X_FINGERPRINT,
    required: false,
    description: 'Client fingerprint for enhanced device binding',
  })
  public async register(
    @Body() dto: RegisterDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<null>> {
    const context = this.buildSessionContext(deviceId, fingerprint);
    await this.authService.register(dto, context);
    return { messageKey: 'success.created', data: null };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token from verification link' })
  @ApiHeader({
    name: HEADERS.X_DEVICE_ID,
    required: false,
    description: 'Unique device identifier for session binding',
  })
  @ApiHeader({
    name: HEADERS.X_FINGERPRINT,
    required: false,
    description: 'Client fingerprint for enhanced device binding',
  })
  public async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    const context = this.buildSessionContext(deviceId, fingerprint);
    const data = await this.authService.verifyEmail(dto.token, context);
    return { messageKey: 'success.ok', data };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend email verification link',
    description:
      'Always returns 200 regardless of whether the account exists to prevent user enumeration.',
  })
  public async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<ITranslatedPayload<null>> {
    await this.authService.resendVerification(dto);
    return { messageKey: 'success.verification_resent', data: null };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiHeader({
    name: HEADERS.X_DEVICE_ID,
    required: false,
    description: 'Unique device identifier for session binding',
  })
  @ApiHeader({
    name: HEADERS.X_FINGERPRINT,
    required: false,
    description: 'Client fingerprint for enhanced device binding',
  })
  public async login(
    @Body() dto: LoginDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    const context = this.buildSessionContext(deviceId, fingerprint);
    const data = await this.authService.login(dto, context);
    return { messageKey: 'success.ok', data };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiHeader({
    name: HEADERS.X_DEVICE_ID,
    required: false,
    description: 'Unique device identifier for session binding',
  })
  @ApiHeader({
    name: HEADERS.X_FINGERPRINT,
    required: false,
    description: 'Client fingerprint for enhanced device binding',
  })
  public async refresh(
    @Body() dto: RefreshTokenDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    const context = this.buildSessionContext(deviceId, fingerprint);
    const data = await this.authService.refresh(dto.refresh_token, context);
    return { messageKey: 'success.ok', data };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — revoke current session' })
  public async logout(): Promise<ITranslatedPayload<null>> {
    await this.authService.logout();
    return { messageKey: 'success.ok', data: null };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  public async me(): Promise<ITranslatedPayload<UserResponseDto>> {
    const data = await this.authService.me();
    return { messageKey: 'success.ok', data };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password — revokes all other sessions' })
  public async changePassword(@Body() dto: ChangePasswordDto): Promise<ITranslatedPayload<null>> {
    await this.authService.changePassword(dto);
    return { messageKey: 'success.ok', data: null };
  }

  // ─── Forgot / Reset Password ─────────────────────────────────────────────

  @Public()
  // Strict: 3 forgot-password requests per hour per IP+email. The
  // AuthThrottlerGuard composes the email into the key so a single IP can't
  // burn another user's quota.
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a password-reset OTP to the given email',
    description:
      'Always returns 200 regardless of whether the account exists to prevent user enumeration.',
  })
  public async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ITranslatedPayload<null>> {
    await this.authService.requestPasswordReset(dto);
    return { messageKey: 'success.ok', data: null };
  }

  @Public()
  // Tight: 10 attempts/min per IP+email. With 6-digit OTPs (1M space) this
  // caps brute-force probability at 150/1_000_000 over the 15-minute window.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using OTP from email',
    description: 'Revokes all existing sessions for the user on success.',
  })
  public async resetPassword(@Body() dto: ResetPasswordDto): Promise<ITranslatedPayload<null>> {
    await this.authService.resetPassword(dto);
    return { messageKey: 'success.ok', data: null };
  }

  // ─── Google SSO — Web Redirect Flow ──────────────────────────────────────

  @Public()
  @UseGuards(GoogleOAuthGuard)
  @Get('sso/google')
  @ApiOperation({
    summary: 'Initiate Google OAuth redirect',
    description:
      'Generates a CSRF-bound state nonce stored in Redis and forwards the user to Google.',
  })
  public async ssoGoogleRedirect(@Query('active_platform') activePlatform?: string): Promise<void> {
    // The guard handles the actual redirect. We don't reach the body — but
    // the guard reads `request.query['state']` to forward to Google, so the
    // nonce needs to be in the URL before Passport runs. That's done in the
    // guard itself via getAuthenticateOptions; this method is unreachable.
    // (Kept for OpenAPI documentation.)
    void activePlatform;
  }

  @Public()
  @UseGuards(GoogleCallbackGuard)
  @Get('sso/google/callback')
  @ApiOperation({
    summary: 'Google OAuth callback — exchanges code for tokens',
    description:
      'Validates the CSRF state nonce, then redirects to the frontend with a single-use exchange code (NO tokens in URL).',
  })
  @ApiHeader({
    name: HEADERS.X_DEVICE_ID,
    required: false,
    description: 'Unique device identifier for session binding',
  })
  @ApiHeader({
    name: HEADERS.X_FINGERPRINT,
    required: false,
    description: 'Client fingerprint for enhanced device binding',
  })
  public async ssoGoogleCallback(
    @Req() request: FastifyRequest & { user: GoogleProfile },
    @Res() reply: FastifyReply,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<void> {
    const context = this.buildSessionContext(deviceId, fingerprint);
    const queryState = (request.query as Record<string, string>)?.['state'];

    // Validate the state nonce to prevent CSRF / forced linking. The stored
    // record is the source of truth for activePlatform — never the URL.
    const stateRecord = await this.oauthStateStore.consume(queryState ?? '');

    const data = await this.authService.ssoLogin(
      SsoProvider.GOOGLE,
      request.user,
      stateRecord.activePlatform,
      context,
    );

    // Redirect with a single-use exchange code rather than token values. The
    // frontend POSTs the code to /auth/sso/exchange to receive tokens once.
    const code = await this.ssoCodeStore.issue(data);
    const baseUrl =
      stateRecord.activePlatform === ActivePlatform.CONSULTANT
        ? this.env.lonaUrl
        : this.env.ployosUrl;
    const redirectUrl = new URL('/auth/sso/callback', baseUrl);
    redirectUrl.searchParams.set('code', code);

    await reply.redirect(redirectUrl.toString());
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('sso/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a single-use SSO code for access/refresh tokens',
    description:
      'Consumes the code emitted by /auth/sso/google/callback. Each code is valid once for a short TTL.',
  })
  public async ssoExchange(
    @Body() dto: SsoExchangeDto,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    const data = await this.ssoCodeStore.consume(dto.code);
    return { messageKey: 'success.ok', data };
  }

  // ─── Google SSO — Token Exchange Flow (SPA/Mobile) ──────────────────────

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('sso/google/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange Google ID token for platform tokens (SPA/mobile)' })
  @ApiHeader({
    name: HEADERS.X_DEVICE_ID,
    required: false,
    description: 'Unique device identifier for session binding',
  })
  @ApiHeader({
    name: HEADERS.X_FINGERPRINT,
    required: false,
    description: 'Client fingerprint for enhanced device binding',
  })
  public async ssoGoogleToken(
    @Body() dto: SsoTokenDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    const context = this.buildSessionContext(deviceId, fingerprint);

    const userData = await this.authService.verifyGoogleIdToken(dto.id_token);
    const data = await this.authService.ssoLogin(
      SsoProvider.GOOGLE,
      userData,
      dto.active_platform,
      context,
    );

    return { messageKey: 'success.ok', data };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  private buildSessionContext(deviceId?: string, fingerprint?: string): ISessionContext {
    return {
      ipAddress: this.requestContext.ipAddress,
      userAgent: this.requestContext.userAgent,
      deviceId: deviceId ?? null,
      fingerprint: fingerprint ?? null,
    };
  }
}
