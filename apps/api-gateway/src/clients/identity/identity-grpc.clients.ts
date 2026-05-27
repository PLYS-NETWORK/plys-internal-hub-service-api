import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

import { GrpcDispatchClientBase } from '../base/grpc-dispatch.client';

export const IDENTITY_GRPC = 'IDENTITY_GRPC';

@Injectable()
export class IdentityAuthClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Auth';

  constructor(@Inject(IDENTITY_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class IdentityAdminAuthClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'AdminAuth';

  constructor(@Inject(IDENTITY_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class IdentityAdminAllowedEmailsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'AdminAllowedEmails';

  constructor(@Inject(IDENTITY_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class IdentityUsersClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Users';

  constructor(@Inject(IDENTITY_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}
