import { Module } from '@nestjs/common';

import { ConsultantClientsModule } from '@/clients/v1/consultant';

import { CONSULTANT_HTTP_PROVIDERS } from './consultant-http.providers';
import { ConsultantDashboardController } from './controllers/consultant-dashboard.controller';
import { ConsultantExploreController } from './controllers/consultant-explore.controller';
import { ConsultantJoinedProjectsController } from './controllers/consultant-joined-projects.controller';
import { ConsultantMembershipController } from './controllers/consultant-membership.controller';
import { ConsultantOnboardingController } from './controllers/consultant-onboarding.controller';
import { ConsultantProfilesController } from './controllers/consultant-profiles.controller';
import { ConsultantProfilesAdminController } from './controllers/consultant-profiles-admin.controller';
import { ConsultantProjectTasksController } from './controllers/consultant-project-tasks.controller';
import { ConsultantSkillExamController } from './controllers/consultant-skill-exam.controller';
import { ExploreController } from './controllers/explore.controller';

@Module({
  imports: [ConsultantClientsModule],
  controllers: [
    ConsultantProfilesController,
    ConsultantProfilesAdminController,
    ConsultantOnboardingController,
    ConsultantSkillExamController,
    ConsultantJoinedProjectsController,
    ConsultantExploreController,
    ConsultantMembershipController,
    ConsultantProjectTasksController,
    ExploreController,
    ConsultantDashboardController,
  ],
  providers: CONSULTANT_HTTP_PROVIDERS,
})
export class ConsultantHttpModule {}
