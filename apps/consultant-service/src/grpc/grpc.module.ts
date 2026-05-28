import { ConsultantOnboardingModule } from '@modules/consultant-onboarding/consultant-onboarding.module';
import { ConsultantProjectsModule } from '@modules/consultant-projects/consultant-projects.module';
import { ConsultantSkillExamModule } from '@modules/consultant-skill-exam/consultant-skill-exam.module';
import { ExploreModule } from '@modules/explore/explore.module';
import { ProfilesModule } from '@modules/profiles/profiles.module';
import { StatisticsModule } from '@modules/statistics/statistics.module';
import { Module } from '@nestjs/common';

/** Feature imports for gRPC bridge HTTP controllers registered on AppModule. */
@Module({
  imports: [
    ProfilesModule,
    ConsultantOnboardingModule,
    ConsultantSkillExamModule,
    ConsultantProjectsModule,
    ExploreModule,
    StatisticsModule,
  ],
})
export class GrpcModule {}
