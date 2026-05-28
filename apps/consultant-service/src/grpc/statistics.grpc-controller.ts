import { Metadata } from '@grpc/grpc-js';
import { ConsultantDashboardController } from '@modules/statistics/consultant/dashboard/consultant-dashboard.controller';
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Controller()
export class StatisticsGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    consultantDashboardController: ConsultantDashboardController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'consultantDashboard',
        instance: consultantDashboardController,
        methods: {
          getSummary: (): Promise<unknown[]> => Promise.resolve([]),
          getActionItems: (): Promise<unknown[]> => Promise.resolve([]),
          getEarningsTrend: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getProjectProgress: (req): Promise<unknown[]> =>
            Promise.resolve([this.parseJsonBody(req)]),
          getSkillPerformance: (req): Promise<unknown[]> =>
            Promise.resolve([this.parseJsonBody(req)]),
        },
      },
    ]);
  }

  @GrpcMethod('Statistics', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
