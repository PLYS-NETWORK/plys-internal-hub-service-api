import { EmailModule } from '@common/modules/email';
import { EnvironmentsModule } from '@common/modules/environments';
import { Module } from '@nestjs/common';

import { UnitOfWorkModule } from '../unit-of-work/unit-of-work.module';
import { ConsultantOnboardingController } from './controllers/consultant-onboarding.controller';
import { ConsultantOnboardingService } from './services/consultant-onboarding.service';
import { OnboardingInterviewService } from './services/onboarding-interview.service';

@Module({
  imports: [UnitOfWorkModule, EmailModule, EnvironmentsModule],
  controllers: [ConsultantOnboardingController],
  providers: [ConsultantOnboardingService, OnboardingInterviewService],
  exports: [ConsultantOnboardingService, OnboardingInterviewService],
})
export class ConsultantOnboardingModule {}
