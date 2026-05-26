import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

interface IIdentityGrpcService {
  validateSession(request: { sessionId?: string; deviceId?: string }): import('rxjs').Observable<{
    valid: boolean;
    userId: string;
    email: string;
    role: string;
    activePlatform: string;
    businessId?: string;
    timezone?: string;
  }>;
}

export interface IValidatedSession {
  userId: string;
  email: string;
  role: string;
  activePlatform: string;
  businessId: string | null;
  timezone: string | null;
}

@Injectable()
export class IdentitySessionClient implements OnModuleInit {
  private identityService!: IIdentityGrpcService;

  constructor(@Inject('IDENTITY_GRPC') private readonly grpcClient: ClientGrpc) {}

  public onModuleInit(): void {
    this.identityService = this.grpcClient.getService<IIdentityGrpcService>('IdentityService');
  }

  public async validateSession(
    sessionId: string,
    deviceId: string | null,
  ): Promise<IValidatedSession | null> {
    const response = await firstValueFrom(
      this.identityService.validateSession({
        sessionId,
        deviceId: deviceId ?? undefined,
      }),
    );

    if (!response.valid) {
      return null;
    }

    return {
      userId: response.userId,
      email: response.email,
      role: response.role,
      activePlatform: response.activePlatform,
      businessId: response.businessId ?? null,
      timezone: response.timezone ?? null,
    };
  }
}
