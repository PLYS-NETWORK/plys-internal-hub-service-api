import { EmailModule } from '@common/modules/email';
import { EnvironmentsModule } from '@common/modules/environments';
import { Module } from '@nestjs/common';

import { UnitOfWorkModule } from '../unit-of-work/unit-of-work.module';
import { AdminConsultantOnboardingController } from './controllers/admin-consultant-onboarding.controller';
import { AdminConsultantOnboardingService } from './services/admin-consultant-onboarding.service';

@Module({
  imports: [UnitOfWorkModule, EmailModule, EnvironmentsModule],
  controllers: [AdminConsultantOnboardingController],
  providers: [AdminConsultantOnboardingService],
  exports: [AdminConsultantOnboardingService],
})
export class AdminConsultantOnboardingModule {}
