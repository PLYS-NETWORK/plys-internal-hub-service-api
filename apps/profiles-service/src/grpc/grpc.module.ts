import { AdminConsultantOnboardingModule } from '@modules/admin-consultant-onboarding/admin-consultant-onboarding.module';
import { AdminConsultantSkillExamModule } from '@modules/admin-consultant-skill-exam/admin-consultant-skill-exam.module';
import { AdminOnboardingQuestionsModule } from '@modules/admin-onboarding-questions/admin-onboarding-questions.module';
import { BusinessOnboardingModule } from '@modules/business-onboarding/business-onboarding.module';
import { ConsultantOnboardingModule } from '@modules/consultant-onboarding/consultant-onboarding.module';
import { ConsultantSkillExamModule } from '@modules/consultant-skill-exam/consultant-skill-exam.module';
import { ProfilesModule } from '@modules/profiles/profiles.module';
import { Module } from '@nestjs/common';

/** Feature imports for gRPC bridge HTTP controllers registered on AppModule. */
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
})
export class GrpcModule {}
