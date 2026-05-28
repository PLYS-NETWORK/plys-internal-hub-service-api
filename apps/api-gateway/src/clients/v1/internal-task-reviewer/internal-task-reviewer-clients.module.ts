import { Global, Module } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';

import { createGrpcClientModuleOptions } from '../../base/create-grpc-client-module.util';
import { GatewayGrpcModule } from '../../base/grpc-gateway.module';
import {
  INTERNAL_TASK_REVIEWER_GRPC,
  TaskReviewsClient,
} from './internal-task-reviewer-grpc.clients';

@Global()
@Module({
  imports: [
    GatewayGrpcModule,
    createGrpcClientModuleOptions(
      'INTERNAL_TASK_REVIEWER',
      INTERNAL_TASK_REVIEWER_GRPC,
      (env: EnvironmentsService) => env.internalTaskReviewerServiceGrpcUrl,
    ),
  ],
  providers: [TaskReviewsClient],
  exports: [TaskReviewsClient],
})
export class InternalTaskReviewerClientsModule {}
