import { AdminConsultantOnboardingModule } from '@modules/admin-consultant-onboarding/admin-consultant-onboarding.module';
import { AdminConsultantSkillExamModule } from '@modules/admin-consultant-skill-exam/admin-consultant-skill-exam.module';
import { AdminOnboardingQuestionsModule } from '@modules/admin-onboarding-questions/admin-onboarding-questions.module';
import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { StatisticsModule } from '@modules/statistics/statistics.module';
import { Module } from '@nestjs/common';

/** Feature imports for gRPC bridge HTTP controllers registered on AppModule. */
@Module({
  imports: [
    AdminConsultantOnboardingModule,
    AdminOnboardingQuestionsModule,
    AdminConsultantSkillExamModule,
    ProjectAiContextModule,
    StatisticsModule,
  ],
})
export class GrpcModule {}
