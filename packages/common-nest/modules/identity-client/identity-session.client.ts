import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import {
  buildExceptionLogMeta,
  formatGrpcTransportError,
  resolveRuntimeServiceName,
  writeServiceLog,
} from '@plys/libraries/common-nest/grpc';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
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
  private readonly logger: AppLogger;

  constructor(
    @Inject('IDENTITY_GRPC') private readonly grpcClient: ClientGrpc,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(IdentitySessionClient.name, requestContext);
  }

  public onModuleInit(): void {
    this.identityService = this.grpcClient.getService<IIdentityGrpcService>('IdentityService');
  }

  public async validateSession(
    sessionId: string,
    deviceId: string | null,
  ): Promise<IValidatedSession | null> {
    try {
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
    } catch (err: unknown) {
      writeServiceLog(
        this.logger,
        `upstream gRPC call failed | service: identity-service | operation: validateSession`,
        HttpStatus.BAD_GATEWAY,
        {
          caller_service: resolveRuntimeServiceName(),
          upstream_service: 'identity-service',
          upstream_client: 'IdentitySessionClient',
          grpc_operation: 'validateSession',
          ...formatGrpcTransportError(err),
          ...buildExceptionLogMeta(err),
        },
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
  }
}
