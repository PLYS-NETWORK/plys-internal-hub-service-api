import { Metadata } from '@grpc/grpc-js';
import { ExploreController } from '@modules/explore/explore.controller';
import { Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class ExploreGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(requestContext: RequestContextService, exploreController: ExploreController) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'explore',
        instance: exploreController,
        methods: {
          listSkills: (): Promise<unknown[]> => Promise.resolve([]),
          listProjects: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getProjectDetail: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'id')]),
        },
      },
    ]);
  }

  @GrpcMethod('Explore', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
