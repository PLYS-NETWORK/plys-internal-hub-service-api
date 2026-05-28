import { Global, Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { createGrpcClientModuleOptions } from '../../base/create-grpc-client-module.util';
import { GatewayGrpcModule } from '../../base/grpc-gateway.module';
import {
  CONSULTANT_GRPC,
  ConsultantOnboardingClient,
  ConsultantProfilesClient,
  ConsultantProjectsClient,
  ConsultantStatisticsClient,
  ExploreClient,
  SkillExamsClient,
} from './consultant-grpc.clients';

@Global()
@Module({
  imports: [
    GatewayGrpcModule,
    createGrpcClientModuleOptions(
      'CONSULTANT',
      CONSULTANT_GRPC,
      (env: EnvironmentsService) => env.consultantServiceGrpcUrl,
    ),
  ],
  providers: [
    ConsultantProfilesClient,
    ConsultantOnboardingClient,
    SkillExamsClient,
    ConsultantProjectsClient,
    ExploreClient,
    ConsultantStatisticsClient,
  ],
  exports: [
    ConsultantProfilesClient,
    ConsultantOnboardingClient,
    SkillExamsClient,
    ConsultantProjectsClient,
    ExploreClient,
    ConsultantStatisticsClient,
  ],
})
export class ConsultantClientsModule {}
