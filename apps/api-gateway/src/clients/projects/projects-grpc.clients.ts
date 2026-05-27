import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

import { GrpcDispatchClientBase } from '../base/grpc-dispatch.client';

export const PROJECTS_GRPC = 'PROJECTS_GRPC';

@Injectable()
export class BusinessProjectsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'BusinessProjects';
  constructor(@Inject(PROJECTS_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class ConsultantProjectsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'ConsultantProjects';
  constructor(@Inject(PROJECTS_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class ExploreClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Explore';
  constructor(@Inject(PROJECTS_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class TaskReviewsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'TaskReviews';
  constructor(@Inject(PROJECTS_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class AiProviderKeysClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'AiProviderKeys';
  constructor(@Inject(PROJECTS_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class ProjectAiContextClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'ProjectAiContext';
  constructor(@Inject(PROJECTS_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class ChatSessionsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'ChatSessions';
  constructor(@Inject(PROJECTS_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}
