import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { RequestContextService } from '../../common/modules/request-context/request-context.service';
import { ITranslatedPayload } from '../../common/interceptors/transform-response.interceptor';
import { ActivePlatform } from '../../database/enums/active-platform.enum';
import { SsoProvider } from '../../database/enums/sso-provider.enum';
import { AuthService } from './auth.service';
import {
  AuthResponseDto,
  ChangePasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  SsoTokenDto,
  UserResponseDto,
  VerifyEmailDto,
} from './dto';
import { GoogleCallbackGuard } from './guards/google-callback.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { ISessionContext } from './interfaces/auth-service.interface';
import { GoogleProfile } from './strategies/google.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly requestContext: RequestContextService,
  ) {}

  // ─── Email / Password ────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user with email/password' })
  public async register(
    @Body() dto: RegisterDto,
    @Headers('x-device-id') deviceId?: string,
    @Headers('x-fingerprint') fingerprint?: string,
  ): Promise<ITranslatedPayload<null>> {
    const context = this.buildSessionContext(deviceId, fingerprint);
    await this.authService.register(dto, context);
    return { messageKey: 'success.created', data: null };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token from verification link' })
  public async verifyEmail(@Body() dto: VerifyEmailDto): Promise<ITranslatedPayload<null>> {
    await this.authService.verifyEmail(dto.token);
    return { messageKey: 'success.ok', data: null };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  public async login(
    @Body() dto: LoginDto,
    @Headers('x-device-id') deviceId?: string,
    @Headers('x-fingerprint') fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    const context = this.buildSessionContext(deviceId, fingerprint);
    const data = await this.authService.login(dto, context);
    return { messageKey: 'success.ok', data };
  }

  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  public async refresh(
    @Body() dto: RefreshTokenDto,
    @Headers('x-device-id') deviceId?: string,
    @Headers('x-fingerprint') fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    const context = this.buildSessionContext(deviceId, fingerprint);
    const data = await this.authService.refresh(dto.refreshToken, context);
    return { messageKey: 'success.ok', data };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — revoke current session' })
  public async logout(@CurrentUser() user: JwtPayload): Promise<ITranslatedPayload<null>> {
    await this.authService.logout(user.sessionId);
    return { messageKey: 'success.ok', data: null };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  public async me(@CurrentUser() user: JwtPayload): Promise<ITranslatedPayload<UserResponseDto>> {
    const data = await this.authService.me(user.sub);
    return { messageKey: 'success.ok', data };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password — revokes all other sessions' })
  public async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<ITranslatedPayload<null>> {
    await this.authService.changePassword(user.sub, dto, user.sessionId);
    return { messageKey: 'success.ok', data: null };
  }

  // ─── Google SSO — Web Redirect Flow ──────────────────────────────────────

  @Public()
  @UseGuards(GoogleOAuthGuard)
  @Get('sso/google')
  @ApiOperation({ summary: 'Initiate Google OAuth redirect' })
  public ssoGoogleRedirect(): void {
    // Guard handles the redirect — this method body is never reached
  }

  @Public()
  @UseGuards(GoogleCallbackGuard)
  @Get('sso/google/callback')
  @ApiOperation({ summary: 'Google OAuth callback — exchanges code for tokens' })
  public async ssoGoogleCallback(
    @Req() request: FastifyRequest & { user: GoogleProfile },
    @Res() reply: FastifyReply,
    @Headers('x-device-id') deviceId?: string,
    @Headers('x-fingerprint') fingerprint?: string,
  ): Promise<void> {
    const context = this.buildSessionContext(deviceId, fingerprint);
    // Default to BUSINESS for the web redirect flow; the state param can override this
    const queryState = (request.query as Record<string, string>)?.['state'];
    const activePlatform = this.parseActivePlatformFromState(queryState);

    const data = await this.authService.ssoLogin(
      SsoProvider.GOOGLE,
      request.user,
      activePlatform,
      context,
    );

    // Redirect back to the frontend with tokens in query params
    // Why: Cookies cannot be set cross-origin from the OAuth callback; the frontend
    // reads these params once, stores them securely, and clears the URL.
    const redirectUrl = new URL('/auth/sso/callback', this.requestContext.path);
    redirectUrl.searchParams.set('access_token', data.accessToken);
    redirectUrl.searchParams.set('refresh_token', data.refreshToken);

    await reply.redirect(redirectUrl.toString());
  }

  // ─── Google SSO — Token Exchange Flow (SPA/Mobile) ──────────────────────

  @Public()
  @Post('sso/google/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange Google ID token for platform tokens (SPA/mobile)' })
  public async ssoGoogleToken(
    @Body() dto: SsoTokenDto,
    @Headers('x-device-id') deviceId?: string,
    @Headers('x-fingerprint') fingerprint?: string,
  ): Promise<ITranslatedPayload<AuthResponseDto>> {
    const context = this.buildSessionContext(deviceId, fingerprint);

    const userData = await this.authService.verifyGoogleIdToken(dto.idToken);
    const data = await this.authService.ssoLogin(
      SsoProvider.GOOGLE,
      userData,
      dto.activePlatform,
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

  private parseActivePlatformFromState(state: string | undefined): ActivePlatform {
    // The state param may encode the platform; otherwise default to BUSINESS
    if (state === ActivePlatform.CONSULTANT) {
      return ActivePlatform.CONSULTANT;
    }
    return ActivePlatform.BUSINESS;
  }
}
