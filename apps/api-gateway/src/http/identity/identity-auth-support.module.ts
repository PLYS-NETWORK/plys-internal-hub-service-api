import { GoogleCallbackGuard } from '@modules/auth/guards/google-callback.guard';
import { GoogleOAuthGuard } from '@modules/auth/guards/google-oauth.guard';
import { RefreshTokenGuard } from '@modules/auth/guards/refresh-token.guard';
import { OAuthStateStore } from '@modules/auth/services/oauth-state-store.service';
import { GoogleStrategy } from '@modules/auth/strategies/google.strategy';
import { RefreshTokenStrategy } from '@modules/auth/strategies/refresh-token.strategy';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PublicEndpointApiKeyGuard } from '@plys/libraries/common-nest/guards/public-endpoint-api-key.guard';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis';
import { RequestContextModule } from '@plys/libraries/common-nest/modules/request-context';

@Module({
  imports: [
    PassportModule,
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
