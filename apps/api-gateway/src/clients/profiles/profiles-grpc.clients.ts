import { Inject, Injectable } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';

import { GrpcDispatchClientBase } from '../base/grpc-dispatch.client';

export const PROFILES_GRPC = 'PROFILES_GRPC';

@Injectable()
export class ProfilesClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'Profiles';

  constructor(@Inject(PROFILES_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class BusinessOnboardingClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'BusinessOnboarding';

  constructor(@Inject(PROFILES_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class ConsultantOnboardingClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'ConsultantOnboarding';

  constructor(@Inject(PROFILES_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class AdminOnboardingClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'AdminOnboarding';

  constructor(@Inject(PROFILES_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}

@Injectable()
export class SkillExamsClient extends GrpcDispatchClientBase {
  protected readonly grpcServiceName = 'SkillExams';

  constructor(@Inject(PROFILES_GRPC) clientGrpc: ClientGrpc) {
    super(clientGrpc);
  }
}
