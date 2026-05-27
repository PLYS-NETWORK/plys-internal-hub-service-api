import { Module } from '@nestjs/common';
import { ProfilesUnitOfWorkModule } from '@plys/libraries/unit-of-work/profiles-unit-of-work.module';

import { BusinessOnboardingService } from './services/business-onboarding.service';

@Module({
  imports: [ProfilesUnitOfWorkModule],
  controllers: [],
  providers: [BusinessOnboardingService],
  exports: [BusinessOnboardingService],
})
export class BusinessOnboardingModule {}
