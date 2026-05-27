import { Metadata } from '@grpc/grpc-js';
import { ChatSessionsController } from '@modules/project-chat-session/controllers/chat-sessions.controller';
import { ProjectSessionsController } from '@modules/project-chat-session/controllers/project-sessions.controller';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Controller()
export class ChatSessionsGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    projectSessionsController: ProjectSessionsController,
    chatSessionsController: ChatSessionsController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'projectSessions',
        instance: projectSessionsController,
        methods: {
          listProjectSessions: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'projectId')]),
          createSession: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'projectId'), this.parseJsonBody(req)]),
        },
      },
      {
        prefix: 'chatSessions',
        instance: chatSessionsController,
        methods: {
          getMeta: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'sessionId')]),
          patch: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'sessionId'), this.parseJsonBody(req)]),
          listMessages: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'sessionId'), this.parseJsonBody(req)]),
          updateStatus: (req): Promise<unknown[]> =>
            Promise.resolve([this.getPathParam(req, 'sessionId'), this.parseJsonBody(req)]),
        },
      },
    ]);
  }

  @GrpcMethod('ChatSessions', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
