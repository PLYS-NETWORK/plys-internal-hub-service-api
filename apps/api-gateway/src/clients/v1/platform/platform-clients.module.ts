import { Global, Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { createGrpcClientModuleOptions } from '../../base/create-grpc-client-module.util';
import { GatewayGrpcModule } from '../../base/grpc-gateway.module';
import {
  FilesClient,
  PLATFORM_GRPC,
  PlatformHealthClient,
  SkillsClient,
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
  providers: [FilesClient, SkillsClient, PlatformHealthClient],
  exports: [FilesClient, SkillsClient, PlatformHealthClient],
})
export class PlatformClientsModule {}
