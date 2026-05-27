import { Global, Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { createGrpcClientModuleOptions } from '../base/create-grpc-client-module.util';
import { GatewayGrpcModule } from '../base/grpc-gateway.module';
import {
  FilesClient,
  NotificationsClient,
  PLATFORM_GRPC,
  PlatformHealthClient,
  SkillsClient,
  StatisticsClient,
} from './platform-grpc.clients';

@Global()
@Module({
  imports: [
    GatewayGrpcModule,
    createGrpcClientModuleOptions(
      'PLATFORM',
      PLATFORM_GRPC,
      (env: EnvironmentsService) => env.platformServiceGrpcUrl,
    ),
  ],
  providers: [
    FilesClient,
    SkillsClient,
    StatisticsClient,
    NotificationsClient,
    PlatformHealthClient,
  ],
  exports: [FilesClient, SkillsClient, StatisticsClient, NotificationsClient, PlatformHealthClient],
})
export class PlatformClientsModule {}
