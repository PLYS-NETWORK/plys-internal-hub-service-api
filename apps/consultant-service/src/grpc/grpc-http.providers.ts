import { ConsultantOnboardingController } from '@modules/consultant-onboarding/controllers/consultant-onboarding.controller';
import { ConsultantExploreController } from '@modules/consultant-projects/controllers/consultant-explore.controller';
import { ConsultantJoinedProjectsController } from '@modules/consultant-projects/controllers/consultant-joined-projects.controller';
import { ConsultantMembershipController } from '@modules/consultant-projects/controllers/consultant-membership.controller';
import { ConsultantProjectTasksController } from '@modules/consultant-projects/controllers/consultant-project-tasks.controller';
import { ConsultantSkillExamController } from '@modules/consultant-skill-exam/controllers/consultant-skill-exam.controller';
import { ExploreController } from '@modules/explore/explore.controller';
import { ConsultantProfilesController } from '@modules/profiles/consultant-profiles.controller';
import { ConsultantProfilesAdminController } from '@modules/profiles/consultant-profiles-admin.controller';
import { ConsultantDashboardController } from '@modules/statistics/consultant/dashboard/consultant-dashboard.controller';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

export const GRPC_HTTP_PROVIDERS = [
  controllerProvider(ConsultantProfilesController),
  controllerProvider(ConsultantProfilesAdminController),
  controllerProvider(ConsultantOnboardingController),
  controllerProvider(ConsultantSkillExamController),
  controllerProvider(ConsultantJoinedProjectsController),
  controllerProvider(ConsultantExploreController),
  controllerProvider(ConsultantMembershipController),
  controllerProvider(ConsultantProjectTasksController),
  controllerProvider(ExploreController),
  controllerProvider(ConsultantDashboardController),
];
