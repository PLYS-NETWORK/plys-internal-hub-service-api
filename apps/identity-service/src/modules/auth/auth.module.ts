import { NotificationsModule } from '@modules/notifications/notifications.module';
import { UsersModule } from '@modules/users/users.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PublicEndpointApiKeyGuard } from '@plys/libraries/common-nest/guards/public-endpoint-api-key.guard';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { AuthService } from './auth.service';
import { GoogleCallbackGuard } from './guards/google-callback.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { GoogleSsoProvider } from './providers/google-sso.provider';
import { SSO_PROVIDERS_TOKEN } from './providers/interfaces/sso-provider.interface';
import { BasicAuthService } from './services/basic-auth.service';
import { LoginAttemptTracker } from './services/login-attempt-tracker.service';
import { OAuthStateStore } from './services/oauth-state-store.service';
import { SessionService } from './services/session.service';
import { SsoAuthService } from './services/sso-auth.service';
import { SsoCodeStore } from './services/sso-code-store.service';
import { UserOnboardingService } from './services/user-onboarding.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';

@Module({
  imports: [
    UnitOfWorkModule,
    UsersModule,
    PassportModule,
    JwtModule.register({}),
    NotificationsModule,
  ],
  controllers: [],
  providers: [
    AuthService,
    UserOnboardingService,
    SessionService,
    BasicAuthService,
    SsoAuthService,
    SsoCodeStore,
    OAuthStateStore,
    LoginAttemptTracker,
    {
      provide: GoogleSsoProvider,
      useFactory: (
        envService: EnvironmentsService,
        requestContext: RequestContextService,
      ): GoogleSsoProvider | null => {
        if (!envService.isGoogleOAuthConfigured) return null;
        return new GoogleSsoProvider(envService, requestContext);
      },
      inject: [EnvironmentsService, RequestContextService],
    },
    {
      provide: SSO_PROVIDERS_TOKEN,
      useFactory: (google: GoogleSsoProvider | null): GoogleSsoProvider[] => {
        return [google].filter(Boolean) as GoogleSsoProvider[];
      },
      inject: [GoogleSsoProvider],
    },
    JwtStrategy,
    RefreshTokenStrategy,
    {
      provide: GoogleStrategy,
      useFactory: (envService: EnvironmentsService): GoogleStrategy | null => {
        if (!envService.isGoogleOAuthConfigured) return null;
        return new GoogleStrategy(envService);
      },
      inject: [EnvironmentsService],
    },
    RefreshTokenGuard,
    GoogleOAuthGuard,
    GoogleCallbackGuard,
    PublicEndpointApiKeyGuard,
  ],
  exports: [AuthService, SessionService, JwtModule],
})
export class AuthModule {}
