import { Module } from '@nestjs/common';

import { UnitOfWorkModule } from '../unit-of-work/unit-of-work.module';
import { AdminOnboardingQuestionsController } from './controllers/admin-onboarding-questions.controller';
import { AdminOnboardingQuestionsService } from './services/admin-onboarding-questions.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [AdminOnboardingQuestionsController],
  providers: [AdminOnboardingQuestionsService],
  exports: [AdminOnboardingQuestionsService],
})
export class AdminOnboardingQuestionsModule {}
