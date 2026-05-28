import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

import { GrpcDispatchClientBase } from '../../base/grpc-dispatch.client';

export const INTERNAL_TASK_REVIEWER_GRPC = 'INTERNAL_TASK_REVIEWER_GRPC';

@Injectable()
export class TaskReviewsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'TaskReviews';

  constructor(@Inject(INTERNAL_TASK_REVIEWER_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}
