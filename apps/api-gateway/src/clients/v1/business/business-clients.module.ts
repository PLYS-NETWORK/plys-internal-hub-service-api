import { Global, Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { createGrpcClientModuleOptions } from '../../base/create-grpc-client-module.util';
import { GatewayGrpcModule } from '../../base/grpc-gateway.module';
import {
  BUSINESS_GRPC,
  BusinessOnboardingClient,
  BusinessProfilesClient,
  BusinessProjectsClient,
  BusinessStatisticsClient,
} from './business-grpc.clients';

@Global()
@Module({
  imports: [
    GatewayGrpcModule,
    createGrpcClientModuleOptions(
      'BUSINESS',
      BUSINESS_GRPC,
      (env: EnvironmentsService) => env.businessServiceGrpcUrl,
    ),
  ],
  providers: [
    BusinessProfilesClient,
    BusinessOnboardingClient,
    BusinessProjectsClient,
    BusinessStatisticsClient,
  ],
  exports: [
    BusinessProfilesClient,
    BusinessOnboardingClient,
    BusinessProjectsClient,
    BusinessStatisticsClient,
  ],
})
export class BusinessClientsModule {}
