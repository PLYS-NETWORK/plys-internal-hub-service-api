import { Global, Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { createGrpcClientModuleOptions } from '../../base/create-grpc-client-module.util';
import { GatewayGrpcModule } from '../../base/grpc-gateway.module';
import {
  AI_PROVIDER_GRPC,
  AiProviderKeysClient,
  ChatSessionsClient,
  ProjectAiContextClient,
} from './ai-provider-grpc.clients';

@Global()
@Module({
  imports: [
    GatewayGrpcModule,
    createGrpcClientModuleOptions(
      'AIPROVIDER',
      AI_PROVIDER_GRPC,
      (env: EnvironmentsService) => env.aiProviderServiceGrpcUrl,
    ),
  ],
  providers: [AiProviderKeysClient, ProjectAiContextClient, ChatSessionsClient],
  exports: [AiProviderKeysClient, ProjectAiContextClient, ChatSessionsClient],
})
export class AiProviderClientsModule {}
