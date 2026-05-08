import { EmailModule } from '@common/modules/email';
import { RedisModule } from '@common/modules/redis';
import { AuthModule } from '@modules/auth/auth.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { AdminAllowedEmailsController } from './admin-allowed-emails.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAllowedEmailsService } from './services/admin-allowed-emails.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminOtpAttemptTracker } from './services/admin-otp-attempt-tracker.service';

@Module({
  imports: [
    UnitOfWorkModule,
    EmailModule,
    RedisModule,
    // AuthModule exports SessionService (and JwtModule) for session creation.
    AuthModule,
  ],
  controllers: [AdminAuthController, AdminAllowedEmailsController],
  providers: [AdminAuthService, AdminOtpAttemptTracker, AdminAllowedEmailsService],
})
export class AdminAuthModule {}
