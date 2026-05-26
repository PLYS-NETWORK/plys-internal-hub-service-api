import { Metadata } from '@grpc/grpc-js';
import { TaskReviewsController } from '@modules/task-reviews/task-reviews.controller';
import { Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class TaskReviewsGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(requestContext: RequestContextService, taskReviewsController: TaskReviewsController) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'taskReviews',
        instance: taskReviewsController,
        methods: {
          listPending: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getDetail: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'reviewId')]),
          vote: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'reviewId'), this.parseJsonBody(req)]),
        },
      },
    ]);
  }

  @GrpcMethod('TaskReviews', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
