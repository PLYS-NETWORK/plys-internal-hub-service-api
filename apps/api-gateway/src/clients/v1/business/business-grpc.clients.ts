import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

import { GrpcDispatchClientBase } from '../../base/grpc-dispatch.client';

export const BUSINESS_GRPC = 'BUSINESS_GRPC';

@Injectable()
export class BusinessProfilesClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Profiles';

  constructor(@Inject(BUSINESS_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class BusinessOnboardingClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'BusinessOnboarding';

  constructor(@Inject(BUSINESS_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class BusinessProjectsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'BusinessProjects';

  constructor(@Inject(BUSINESS_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class BusinessStatisticsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Statistics';

  constructor(@Inject(BUSINESS_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}
