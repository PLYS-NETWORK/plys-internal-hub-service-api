import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PublicEndpointApiKeyGuard } from '@plys/libraries/common-nest/guards/public-endpoint-api-key.guard';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis';
import { RequestContextModule } from '@plys/libraries/common-nest/modules/request-context';

import { GoogleCallbackGuard } from './auth-support/guards/google-callback.guard';
import { GoogleOAuthGuard } from './auth-support/guards/google-oauth.guard';
import { RefreshTokenGuard } from './auth-support/guards/refresh-token.guard';
import { OAuthStateStore } from './auth-support/oauth-state-store.service';
import { GoogleStrategy } from './auth-support/strategies/google.strategy';
import { RefreshTokenStrategy } from './auth-support/strategies/refresh-token.strategy';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    JwtModule.register({}),
    EnvironmentsModule,
    RedisModule,
    RequestContextModule,
  ],
  providers: [
    OAuthStateStore,
    RefreshTokenStrategy,
    RefreshTokenGuard,
    GoogleOAuthGuard,
    GoogleCallbackGuard,
    PublicEndpointApiKeyGuard,
    {
      provide: GoogleStrategy,
      useFactory: (envService: EnvironmentsService): GoogleStrategy | null => {
        if (!envService.isGoogleOAuthConfigured) return null;
        return new GoogleStrategy(envService);
      },
      inject: [EnvironmentsService],
    },
  ],
  exports: [
    OAuthStateStore,
    RefreshTokenGuard,
    GoogleOAuthGuard,
    GoogleCallbackGuard,
    PublicEndpointApiKeyGuard,
  ],
})
export class IdentityAuthSupportModule {}
