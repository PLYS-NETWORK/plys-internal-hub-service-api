import { Module } from '@nestjs/common';
import { ProfilesUnitOfWorkModule } from '@plys/libraries/unit-of-work/profiles-unit-of-work.module';

import { AdminOnboardingQuestionsService } from './services/admin-onboarding-questions.service';

@Module({
  imports: [ProfilesUnitOfWorkModule],
  controllers: [],
  providers: [AdminOnboardingQuestionsService],
  exports: [AdminOnboardingQuestionsService],
})
export class AdminOnboardingQuestionsModule {}
