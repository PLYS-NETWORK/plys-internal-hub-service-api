import { Module } from '@nestjs/common';
import { EmailModule } from '@plys/libraries/common-nest/modules/email';
import { EnvironmentsModule } from '@plys/libraries/common-nest/modules/environments';
import { ProfilesUnitOfWorkModule } from '@plys/libraries/unit-of-work/profiles-unit-of-work.module';

import { ConsultantOnboardingService } from './services/consultant-onboarding.service';
import { OnboardingInterviewService } from './services/onboarding-interview.service';

@Module({
  imports: [ProfilesUnitOfWorkModule, EmailModule, EnvironmentsModule],
  controllers: [],
  providers: [ConsultantOnboardingService, OnboardingInterviewService],
  exports: [ConsultantOnboardingService, OnboardingInterviewService],
})
export class ConsultantOnboardingModule {}
