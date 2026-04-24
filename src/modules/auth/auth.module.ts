import { EnvironmentsService } from '@common/modules/environments';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { UsersModule } from '@modules/users/users.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleCallbackGuard } from './guards/google-callback.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { GoogleSsoProvider } from './providers/google-sso.provider';
import { SSO_PROVIDERS_TOKEN } from './providers/interfaces/sso-provider.interface';
import { BasicAuthService } from './services/basic-auth.service';
import { SessionService } from './services/session.service';
import { SsoAuthService } from './services/sso-auth.service';
import { UserOnboardingService } from './services/user-onboarding.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';

@Module({
  imports: [UnitOfWorkModule, UsersModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    // ─── Facade ──────────────────────────────────────────────────────────
    AuthService,

    // ─── Sub-services ─────────────────────────────────────────────────────
    UserOnboardingService,
    SessionService,
    BasicAuthService,
    SsoAuthService,

    // ─── SSO Providers (OCP: new provider = new entry here only) ─────────
    // GoogleSsoProvider throws during construction when clientID is absent.
    // Use a factory so it is only instantiated when all three env vars are set.
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
    // The SSO_PROVIDERS_TOKEN array is injected into SsoAuthService.
    // To add Apple/Microsoft: create the provider class and add it here.
    {
      provide: SSO_PROVIDERS_TOKEN,
      useFactory: (google: GoogleSsoProvider | null): GoogleSsoProvider[] => {
        return [google].filter(Boolean) as GoogleSsoProvider[];
      },
      inject: [GoogleSsoProvider],
    },

    // ─── Passport strategies ─────────────────────────────────────────────
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

    // ─── Guards ───────────────────────────────────────────────────────────
    RefreshTokenGuard,
    GoogleOAuthGuard,
    GoogleCallbackGuard,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
