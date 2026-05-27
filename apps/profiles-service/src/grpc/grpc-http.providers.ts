import { AdminConsultantOnboardingController } from '@modules/admin-consultant-onboarding/controllers/admin-consultant-onboarding.controller';
import { AdminConsultantSkillExamController } from '@modules/admin-consultant-skill-exam/controllers/admin-consultant-skill-exam.controller';
import { AdminOnboardingQuestionsController } from '@modules/admin-onboarding-questions/controllers/admin-onboarding-questions.controller';
import { BusinessOnboardingController } from '@modules/business-onboarding/controllers/business-onboarding.controller';
import { ConsultantOnboardingController } from '@modules/consultant-onboarding/controllers/consultant-onboarding.controller';
import { ConsultantSkillExamController } from '@modules/consultant-skill-exam/controllers/consultant-skill-exam.controller';
import { BusinessProfilesController } from '@modules/profiles/business/business-profiles.controller';
import { BusinessProfilesAdminController } from '@modules/profiles/business/business-profiles-admin.controller';
import { ConsultantProfilesController } from '@modules/profiles/consultant/consultant-profiles.controller';
import { ConsultantProfilesAdminController } from '@modules/profiles/consultant/consultant-profiles-admin.controller';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

export const GRPC_HTTP_PROVIDERS = [
  controllerProvider(BusinessProfilesController),
  controllerProvider(BusinessProfilesAdminController),
  controllerProvider(ConsultantProfilesController),
  controllerProvider(ConsultantProfilesAdminController),
  controllerProvider(BusinessOnboardingController),
  controllerProvider(ConsultantOnboardingController),
  controllerProvider(AdminConsultantOnboardingController),
  controllerProvider(AdminOnboardingQuestionsController),
  controllerProvider(ConsultantSkillExamController),
  controllerProvider(AdminConsultantSkillExamController),
];
