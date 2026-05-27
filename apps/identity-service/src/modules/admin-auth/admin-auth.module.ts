import { AuthModule } from '@modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { EmailModule } from '@plys/libraries/common-nest/modules/email';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

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
  controllers: [],
  providers: [AdminAuthService, AdminOtpAttemptTracker, AdminAllowedEmailsService],
  exports: [AdminAuthService, AdminAllowedEmailsService],
})
export class AdminAuthModule {}
