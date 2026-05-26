import { Metadata } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { GrpcBridgeBase, IHttpResponse } from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

/** Placeholder bridge — UsersController has no HTTP routes yet. */
@Injectable()
export class UsersGrpcController extends GrpcBridgeBase {
  protected readonly handlers = {};

  constructor(requestContext: RequestContextService) {
    super(requestContext);
  }

  @GrpcMethod('Users', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
