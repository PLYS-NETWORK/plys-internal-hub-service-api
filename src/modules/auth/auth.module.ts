import { EnvironmentsService } from '@common/modules/environments';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { UsersModule } from '@modules/users/users.module';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard';
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
    // Single permissive default tier applies to every controller method
    // (60 requests / minute / IP). Auth-sensitive endpoints override this
    // via `@Throttle({ default: { limit, ttl } })` for strict limits.
    ThrottlerModule.forRootAsync({
      inject: [EnvironmentsService],
      useFactory: (env: EnvironmentsService) => ({
        throttlers: [{ name: 'default', limit: 60, ttl: 60_000 }],
        storage: new ThrottlerStorageRedisService({
          host: env.redisHost,
          port: env.redisPort,
          password: env.redisPassword,
          db: env.redisDb,
          tls: env.redisTlsEnabled ? {} : undefined,
          // Compose the global namespace so multi-env Redis stays isolated.
          keyPrefix: `${env.redisKeyPrefix}${env.throttleRedisPrefix}`,
        }),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    // ─── Facade ──────────────────────────────────────────────────────────
    AuthService,

    // ─── Sub-services ─────────────────────────────────────────────────────
    UserOnboardingService,
    SessionService,
    BasicAuthService,
    SsoAuthService,
    SsoCodeStore,
    OAuthStateStore,
    LoginAttemptTracker,

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

    // Module-scoped throttler guard. Keys on email+ip for /login and
    // /forgot-password, otherwise falls back to the default IP-only key.
    { provide: APP_GUARD, useClass: AuthThrottlerGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
