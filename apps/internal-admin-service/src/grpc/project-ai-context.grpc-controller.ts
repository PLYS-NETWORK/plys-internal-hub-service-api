import { Metadata } from '@grpc/grpc-js';
import { ProjectAiContextAdminController } from '@modules/project-ai-context/project-ai-context-admin.controller';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  GrpcIdempotencyService,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Controller()
export class ProjectAiContextGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    private readonly idempotency: GrpcIdempotencyService,
    projectAiContextAdminController: ProjectAiContextAdminController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'projectAiContextAdmin',
        instance: projectAiContextAdminController,
        methods: {
          getContext: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'projectId')]),
        },
      },
    ]);
  }

  @GrpcMethod('ProjectAiContext', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return this.idempotency.wrapDispatch(request, metadata, () =>
      super.dispatch(request, metadata),
    );
  }
}
