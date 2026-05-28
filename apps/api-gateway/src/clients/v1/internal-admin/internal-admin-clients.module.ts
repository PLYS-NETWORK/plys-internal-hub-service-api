import { Global, Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { createGrpcClientModuleOptions } from '../../base/create-grpc-client-module.util';
import { GatewayGrpcModule } from '../../base/grpc-gateway.module';
import {
  AdminOnboardingClient,
  AdminProjectAiContextClient,
  AdminSkillExamsClient,
  AdminStatisticsClient,
  INTERNAL_ADMIN_GRPC,
} from './internal-admin-grpc.clients';

@Global()
@Module({
  imports: [
    GatewayGrpcModule,
    createGrpcClientModuleOptions(
      'INTERNAL_ADMIN',
      INTERNAL_ADMIN_GRPC,
      (env: EnvironmentsService) => env.internalAdminServiceGrpcUrl,
    ),
  ],
  providers: [
    AdminOnboardingClient,
    AdminSkillExamsClient,
    AdminProjectAiContextClient,
    AdminStatisticsClient,
  ],
  exports: [
    AdminOnboardingClient,
    AdminSkillExamsClient,
    AdminProjectAiContextClient,
    AdminStatisticsClient,
  ],
})
export class InternalAdminClientsModule {}
