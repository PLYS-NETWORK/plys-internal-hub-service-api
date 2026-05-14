import { Module } from '@nestjs/common';

import { UnitOfWorkModule } from '../unit-of-work/unit-of-work.module';
import { BusinessOnboardingController } from './controllers/business-onboarding.controller';
import { BusinessOnboardingService } from './services/business-onboarding.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [BusinessOnboardingController],
  providers: [BusinessOnboardingService],
  exports: [BusinessOnboardingService],
})
export class BusinessOnboardingModule {}
