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
} from '@plys/libraries/api-contracts/auth/dto';
import {
  HEADERS,
  THROTTLE_DEFAULT,
  THROTTLE_INTERACTIVE,
  THROTTLE_MODERATE,
  THROTTLE_OTP,
  THROTTLE_STRICT,
} from '@plys/libraries/common-nest/constants';
import { Public } from '@plys/libraries/common-nest/decorators/public.decorator';
import { assertGrpcSuccess, GrpcGatewayHelper } from '@plys/libraries/common-nest/grpc';
import { PublicEndpointApiKeyGuard } from '@plys/libraries/common-nest/guards/public-endpoint-api-key.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { FastifyReply, FastifyRequest } from 'fastify';

import { IdentityAuthClient } from '@/clients/identity';
import { sessionQueryParams } from '@/http/v1/shared/session-query.util';

import { GoogleCallbackGuard } from './auth-support/guards/google-callback.guard';
import { GoogleOAuthGuard } from './auth-support/guards/google-oauth.guard';
import { RefreshTokenGuard } from './auth-support/guards/refresh-token.guard';
import { GoogleProfile } from './auth-support/strategies/google.strategy';

@ApiTags('Auth')
@Controller('auth')
@Throttle(THROTTLE_DEFAULT)
export class AuthController {
  constructor(
    private readonly authClient: IdentityAuthClient,
    private readonly grpcHelper: GrpcGatewayHelper,
  ) {}

  @Public()
  @UseGuards(PublicEndpointApiKeyGuard)
  @ApiSecurity('x-api-key')
  @Throttle(THROTTLE_STRICT)
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
  public register(
    @Body() dto: RegisterDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<null>> {
    return this.grpcHelper.call(this.authClient, 'register', {
      body: dto,
      queryParams: sessionQueryParams(deviceId, fingerprint),
    });
  }

  @Public()
  @Throttle(THROTTLE_MODERATE)
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
  public verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    return this.grpcHelper.call(this.authClient, 'verifyEmail', {
      body: dto,
      queryParams: sessionQueryParams(deviceId, fingerprint),
    });
  }

  @Public()
  @Throttle(THROTTLE_OTP)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend email verification link',
    description:
      'Always returns 200 regardless of whether the account exists to prevent user enumeration.',
  })
  public resendVerification(@Body() dto: ResendVerificationDto): Promise<ITranslatedPayload<null>> {
    return this.grpcHelper.call(this.authClient, 'resendVerification', { body: dto });
  }

  @Public()
  @Throttle(THROTTLE_STRICT)
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
  public login(
    @Body() dto: LoginDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    return this.grpcHelper.call(this.authClient, 'login', {
      body: dto,
      queryParams: sessionQueryParams(deviceId, fingerprint),
    });
  }

  @Public()
  @Throttle(THROTTLE_INTERACTIVE)
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
  public refresh(
    @Body() dto: RefreshTokenDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    return this.grpcHelper.call(this.authClient, 'refresh', {
      body: dto,
      queryParams: sessionQueryParams(deviceId, fingerprint),
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — revoke current session' })
  public logout(): Promise<ITranslatedPayload<null>> {
    return this.grpcHelper.call(this.authClient, 'logout', {});
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  public me(): Promise<ITranslatedPayload<UserResponseDto>> {
    return this.grpcHelper.call(this.authClient, 'me', {});
  }

  @Throttle(THROTTLE_STRICT)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password — revokes all other sessions' })
  public changePassword(@Body() dto: ChangePasswordDto): Promise<ITranslatedPayload<null>> {
    return this.grpcHelper.call(this.authClient, 'changePassword', { body: dto });
  }

  @Public()
  @Throttle(THROTTLE_OTP)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a password-reset OTP to the given email',
    description:
      'Always returns 200 regardless of whether the account exists to prevent user enumeration.',
  })
  public forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ITranslatedPayload<null>> {
    return this.grpcHelper.call(this.authClient, 'forgotPassword', { body: dto });
  }

  @Public()
  @Throttle(THROTTLE_MODERATE)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using OTP from email',
    description: 'Revokes all existing sessions for the user on success.',
  })
  public resetPassword(@Body() dto: ResetPasswordDto): Promise<ITranslatedPayload<null>> {
    return this.grpcHelper.call(this.authClient, 'resetPassword', { body: dto });
  }

  @Public()
  @UseGuards(GoogleOAuthGuard)
  @Get('sso/google')
  @ApiOperation({
    summary: 'Initiate Google OAuth redirect',
    description:
      'Generates a CSRF-bound state nonce stored in Redis and forwards the user to Google.',
  })
  public ssoGoogleRedirect(@Query('active_platform') activePlatform?: string): void {
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
    const queryState = (request.query as Record<string, string> | undefined)?.['state'] ?? '';
    const response = await this.grpcHelper.callRaw(this.authClient, {
      operation: 'ssoGoogleCallback',
      body: Buffer.from(JSON.stringify({ googleProfile: request.user, queryState })),
      queryParams: sessionQueryParams(deviceId, fingerprint),
    });

    const location = response.headers?.['location'];
    if (location) {
      await reply.redirect(location, response.statusCode ?? HttpStatus.FOUND);
      return;
    }

    assertGrpcSuccess(response);
  }

  @Public()
  @Throttle(THROTTLE_MODERATE)
  @Post('sso/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a single-use SSO code for access/refresh tokens',
    description:
      'Consumes the code emitted by /auth/sso/google/callback. Each code is valid once for a short TTL.',
  })
  public ssoExchange(@Body() dto: SsoExchangeDto): Promise<ITranslatedPayload<AuthResponseDto>> {
    return this.grpcHelper.call(this.authClient, 'ssoExchange', { body: dto });
  }

  @Public()
  @Throttle(THROTTLE_MODERATE)
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
  public ssoGoogleToken(
    @Body() dto: SsoTokenDto,
    @Headers(HEADERS.X_DEVICE_ID) deviceId?: string,
    @Headers(HEADERS.X_FINGERPRINT) fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    return this.grpcHelper.call(this.authClient, 'ssoGoogleToken', {
      body: dto,
      queryParams: sessionQueryParams(deviceId, fingerprint),
    });
  }
}
