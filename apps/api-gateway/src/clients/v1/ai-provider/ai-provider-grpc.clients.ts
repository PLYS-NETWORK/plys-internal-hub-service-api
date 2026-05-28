import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

import { GrpcDispatchClientBase } from '../../base/grpc-dispatch.client';

export const AI_PROVIDER_GRPC = 'AI_PROVIDER_GRPC';

@Injectable()
export class AiProviderKeysClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'AiProviderKeys';

  constructor(@Inject(AI_PROVIDER_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class ProjectAiContextClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'ProjectAiContext';

  constructor(@Inject(AI_PROVIDER_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class ChatSessionsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'ChatSessions';

  constructor(@Inject(AI_PROVIDER_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}
