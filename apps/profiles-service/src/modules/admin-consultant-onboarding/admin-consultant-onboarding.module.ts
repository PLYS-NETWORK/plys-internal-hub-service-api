import { Module } from '@nestjs/common';
import { EmailModule } from '@plys/libraries/common-nest/modules/email';
import { EnvironmentsModule } from '@plys/libraries/common-nest/modules/environments';
import { ProfilesUnitOfWorkModule } from '@plys/libraries/unit-of-work/profiles-unit-of-work.module';

import { AdminConsultantOnboardingService } from './services/admin-consultant-onboarding.service';

@Module({
  imports: [ProfilesUnitOfWorkModule, EmailModule, EnvironmentsModule],
  controllers: [],
  providers: [AdminConsultantOnboardingService],
  exports: [AdminConsultantOnboardingService],
})
export class AdminConsultantOnboardingModule {}
