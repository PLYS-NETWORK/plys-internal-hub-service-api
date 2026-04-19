import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { EnvironmentsService } from '@common/modules/environments';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { UsersModule } from '@modules/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleCallbackGuard } from './guards/google-callback.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';

@Module({
  imports: [UnitOfWorkModule, UsersModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    RefreshTokenStrategy,
    // GoogleStrategy throws during construction when clientID is absent.
    // Use a factory so it is only instantiated when all three env vars are set.
    // The guards independently return 503 when unconfigured, so the Passport
    // strategy is never reached in that case.
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
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
