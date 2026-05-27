import { Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { createGrpcClientModuleOptions } from '../base/create-grpc-client-module.util';
import {
  AdminOnboardingClient,
  BusinessOnboardingClient,
  ConsultantOnboardingClient,
  PROFILES_GRPC,
  ProfilesClient,
  SkillExamsClient,
} from './profiles-grpc.clients';

@Module({
  imports: [
    createGrpcClientModuleOptions(
      'PROFILES',
      PROFILES_GRPC,
      (env: EnvironmentsService) => env.profilesServiceGrpcUrl,
    ),
  ],
  providers: [
    ProfilesClient,
    BusinessOnboardingClient,
    ConsultantOnboardingClient,
    AdminOnboardingClient,
    SkillExamsClient,
  ],
  exports: [
    ProfilesClient,
    BusinessOnboardingClient,
    ConsultantOnboardingClient,
    AdminOnboardingClient,
    SkillExamsClient,
  ],
})
export class ProfilesClientsModule {}
