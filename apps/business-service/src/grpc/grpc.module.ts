import { BusinessOnboardingModule } from '@modules/business-onboarding/business-onboarding.module';
import { BusinessProjectsModule } from '@modules/business-projects/business-projects.module';
import { ProfilesModule } from '@modules/profiles/profiles.module';
import { StatisticsModule } from '@modules/statistics/statistics.module';
import { Module } from '@nestjs/common';

/** Feature imports for gRPC bridge HTTP controllers registered on AppModule. */
@Module({
  imports: [ProfilesModule, BusinessOnboardingModule, BusinessProjectsModule, StatisticsModule],
})
export class GrpcModule {}
