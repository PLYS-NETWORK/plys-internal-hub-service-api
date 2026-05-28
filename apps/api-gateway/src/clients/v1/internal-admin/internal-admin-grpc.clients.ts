import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

import { GrpcDispatchClientBase } from '../../base/grpc-dispatch.client';

export const INTERNAL_ADMIN_GRPC = 'INTERNAL_ADMIN_GRPC';

@Injectable()
export class AdminOnboardingClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'AdminOnboarding';

  constructor(@Inject(INTERNAL_ADMIN_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class AdminSkillExamsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'SkillExams';

  constructor(@Inject(INTERNAL_ADMIN_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class AdminProjectAiContextClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'ProjectAiContext';

  constructor(@Inject(INTERNAL_ADMIN_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class AdminStatisticsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Statistics';

  constructor(@Inject(INTERNAL_ADMIN_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}
