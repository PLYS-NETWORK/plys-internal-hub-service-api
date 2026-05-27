import { Global, Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { createGrpcClientModuleOptions } from '../base/create-grpc-client-module.util';
import { GatewayGrpcModule } from '../base/grpc-gateway.module';
import {
  AiProviderKeysClient,
  BusinessProjectsClient,
  ChatSessionsClient,
  ConsultantProjectsClient,
  ExploreClient,
  ProjectAiContextClient,
  PROJECTS_GRPC,
  TaskReviewsClient,
} from './projects-grpc.clients';

@Global()
@Module({
  imports: [
    GatewayGrpcModule,
    createGrpcClientModuleOptions(
      'PROJECTS',
      PROJECTS_GRPC,
      (env: EnvironmentsService) => env.projectsServiceGrpcUrl,
    ),
  ],
  providers: [
    BusinessProjectsClient,
    ConsultantProjectsClient,
    ExploreClient,
    TaskReviewsClient,
    AiProviderKeysClient,
    ProjectAiContextClient,
    ChatSessionsClient,
  ],
  exports: [
    BusinessProjectsClient,
    ConsultantProjectsClient,
    ExploreClient,
    TaskReviewsClient,
    AiProviderKeysClient,
    ProjectAiContextClient,
    ChatSessionsClient,
  ],
})
export class ProjectsClientsModule {}
