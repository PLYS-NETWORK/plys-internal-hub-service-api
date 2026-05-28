import { AdminConsultantOnboardingController } from '@modules/admin-consultant-onboarding/controllers/admin-consultant-onboarding.controller';
import { AdminConsultantSkillExamController } from '@modules/admin-consultant-skill-exam/controllers/admin-consultant-skill-exam.controller';
import { AdminOnboardingQuestionsController } from '@modules/admin-onboarding-questions/controllers/admin-onboarding-questions.controller';
import { ProjectAiContextAdminController } from '@modules/project-ai-context/project-ai-context-admin.controller';
import { AdminStatisticsController } from '@modules/statistics/admin/admin-statistics.controller';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

export const GRPC_HTTP_PROVIDERS = [
  controllerProvider(AdminConsultantOnboardingController),
  controllerProvider(AdminOnboardingQuestionsController),
  controllerProvider(AdminConsultantSkillExamController),
  controllerProvider(ProjectAiContextAdminController),
  controllerProvider(AdminStatisticsController),
];
