import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

import { GrpcDispatchClientBase } from '../../base/grpc-dispatch.client';

export const CONSULTANT_GRPC = 'CONSULTANT_GRPC';

@Injectable()
export class ConsultantProfilesClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Profiles';

  constructor(@Inject(CONSULTANT_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class ConsultantOnboardingClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'ConsultantOnboarding';

  constructor(@Inject(CONSULTANT_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class SkillExamsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'SkillExams';

  constructor(@Inject(CONSULTANT_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class ConsultantProjectsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'ConsultantProjects';

  constructor(@Inject(CONSULTANT_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class ExploreClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Explore';

  constructor(@Inject(CONSULTANT_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class ConsultantStatisticsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Statistics';

  constructor(@Inject(CONSULTANT_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}
