import { AdminConsultantOnboardingModule } from '@modules/admin-consultant-onboarding/admin-consultant-onboarding.module';
import { AdminConsultantOnboardingController } from '@modules/admin-consultant-onboarding/controllers/admin-consultant-onboarding.controller';
import { AdminConsultantSkillExamModule } from '@modules/admin-consultant-skill-exam/admin-consultant-skill-exam.module';
import { AdminConsultantSkillExamController } from '@modules/admin-consultant-skill-exam/controllers/admin-consultant-skill-exam.controller';
import { AdminOnboardingQuestionsModule } from '@modules/admin-onboarding-questions/admin-onboarding-questions.module';
import { AdminOnboardingQuestionsController } from '@modules/admin-onboarding-questions/controllers/admin-onboarding-questions.controller';
import { BusinessOnboardingModule } from '@modules/business-onboarding/business-onboarding.module';
import { BusinessOnboardingController } from '@modules/business-onboarding/controllers/business-onboarding.controller';
import { ConsultantOnboardingModule } from '@modules/consultant-onboarding/consultant-onboarding.module';
import { ConsultantOnboardingController } from '@modules/consultant-onboarding/controllers/consultant-onboarding.controller';
import { ConsultantSkillExamModule } from '@modules/consultant-skill-exam/consultant-skill-exam.module';
import { ConsultantSkillExamController } from '@modules/consultant-skill-exam/controllers/consultant-skill-exam.controller';
import { BusinessProfilesController } from '@modules/profiles/business/business-profiles.controller';
import { BusinessProfilesAdminController } from '@modules/profiles/business/business-profiles-admin.controller';
import { ConsultantProfilesController } from '@modules/profiles/consultant/consultant-profiles.controller';
import { ConsultantProfilesAdminController } from '@modules/profiles/consultant/consultant-profiles-admin.controller';
import { ProfilesModule } from '@modules/profiles/profiles.module';
import { Module } from '@nestjs/common';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

import { AdminOnboardingGrpcController } from './admin-onboarding.grpc-controller';
import { BusinessOnboardingGrpcController } from './business-onboarding.grpc-controller';
import { ConsultantOnboardingGrpcController } from './consultant-onboarding.grpc-controller';
import { HealthGrpcController } from './health.grpc-controller';
import { ProfilesGrpcController } from './profiles.grpc-controller';
import { SkillExamsGrpcController } from './skill-exams.grpc-controller';

@Module({
  imports: [
    ProfilesModule,
    BusinessOnboardingModule,
    ConsultantOnboardingModule,
    AdminConsultantOnboardingModule,
    AdminOnboardingQuestionsModule,
    ConsultantSkillExamModule,
    AdminConsultantSkillExamModule,
  ],
  controllers: [
    HealthGrpcController,
    ProfilesGrpcController,
    BusinessOnboardingGrpcController,
    ConsultantOnboardingGrpcController,
    AdminOnboardingGrpcController,
    SkillExamsGrpcController,
  ],
  providers: [
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
  ],
})
export class GrpcModule {}
