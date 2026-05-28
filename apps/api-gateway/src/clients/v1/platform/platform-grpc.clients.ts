import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

import { GrpcDispatchClientBase } from '../../base/grpc-dispatch.client';

export const PLATFORM_GRPC = 'PLATFORM_GRPC';

@Injectable()
export class FilesClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Files';
  constructor(@Inject(PLATFORM_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class SkillsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Skills';
  constructor(@Inject(PLATFORM_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class PlatformHealthClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Health';
  constructor(@Inject(PLATFORM_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}
