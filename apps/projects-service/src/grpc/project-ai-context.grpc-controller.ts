import { Metadata } from '@grpc/grpc-js';
import { AiBootstrapController } from '@modules/ai-bootstrap/ai-bootstrap.controller';
import { ProjectAiContextController } from '@modules/project-ai-context/project-ai-context.controller';
import { ProjectAiContextAdminController } from '@modules/project-ai-context/project-ai-context-admin.controller';
import { Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  GrpcIdempotencyService,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class ProjectAiContextGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    private readonly idempotency: GrpcIdempotencyService,
    projectAiContextController: ProjectAiContextController,
    projectAiContextAdminController: ProjectAiContextAdminController,
    aiBootstrapController: AiBootstrapController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'projectAiContext',
        instance: projectAiContextController,
        methods: {
          logDecision: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'projectId'), this.parseJsonBody(req)]),
          updateDerived: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'projectId'), this.parseJsonBody(req)]),
        },
      },
      {
        prefix: 'projectAiContextAdmin',
        instance: projectAiContextAdminController,
        methods: {
          getContext: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'projectId')]),
        },
      },
      {
        prefix: 'aiBootstrap',
        instance: aiBootstrapController,
        methods: {
          bootstrap: (req): Promise<unknown[]> =>
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
