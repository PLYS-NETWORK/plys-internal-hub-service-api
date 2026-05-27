import { Metadata } from '@grpc/grpc-js';
import { HealthController } from '@modules/health/health.controller';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

interface IHealthCheckRequest {
  service?: string;
}

interface IHealthCheckResponse {
  status: number;
}

@Controller()
export class HealthGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(requestContext: RequestContextService, healthController: HealthController) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'health',
        instance: healthController,
        methods: {
          check: (): Promise<unknown[]> => Promise.resolve([]),
        },
      },
    ]);
  }

  @GrpcMethod('Health', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }

  @GrpcMethod('Health', 'Check')
  public check(_request: IHealthCheckRequest): IHealthCheckResponse {
    return { status: 1 };
  }
}
