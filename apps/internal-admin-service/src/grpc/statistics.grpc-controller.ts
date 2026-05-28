import { Metadata } from '@grpc/grpc-js';
import { AdminStatisticsController } from '@modules/statistics/admin/admin-statistics.controller';
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
    adminStatisticsController: AdminStatisticsController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'adminStatistics',
        instance: adminStatisticsController,
        methods: {
          getSummary: (): Promise<unknown[]> => Promise.resolve([]),
          getUsersBreakdown: (): Promise<unknown[]> => Promise.resolve([]),
          getGrowthTrend: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getOperationalQueues: (): Promise<unknown[]> => Promise.resolve([]),
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
