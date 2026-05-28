import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

import { GrpcDispatchClientBase } from '../../base/grpc-dispatch.client';

export const NOTIFICATIONS_GRPC = 'NOTIFICATIONS_GRPC';

@Injectable()
export class NotificationsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Notifications';

  constructor(@Inject(NOTIFICATIONS_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}
