import { Module } from '@nestjs/common';

import { InternalAdminClientsModule } from '@/clients/v1/internal-admin';

import { AdminConsultantOnboardingController } from './controllers/admin-consultant-onboarding.controller';
import { AdminConsultantSkillExamController } from './controllers/admin-consultant-skill-exam.controller';
import { AdminOnboardingQuestionsController } from './controllers/admin-onboarding-questions.controller';
import { AdminStatisticsController } from './controllers/admin-statistics.controller';
import { ProjectAiContextAdminController } from './controllers/project-ai-context-admin.controller';
import { INTERNAL_ADMIN_HTTP_PROVIDERS } from './internal-admin-http.providers';

@Module({
  imports: [InternalAdminClientsModule],
  controllers: [
    AdminConsultantOnboardingController,
    AdminOnboardingQuestionsController,
    AdminConsultantSkillExamController,
    AdminStatisticsController,
    ProjectAiContextAdminController,
  ],
  providers: INTERNAL_ADMIN_HTTP_PROVIDERS,
})
export class InternalAdminHttpModule {}
