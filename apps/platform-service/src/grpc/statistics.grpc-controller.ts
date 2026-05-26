import { Metadata } from '@grpc/grpc-js';
import { AdminStatisticsController } from '@modules/statistics/admin/admin-statistics.controller';
import { BusinessDashboardController } from '@modules/statistics/business/dashboard/business-dashboard.controller';
import { ConsultantDashboardController } from '@modules/statistics/consultant/dashboard/consultant-dashboard.controller';
import { Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class StatisticsGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    adminStatisticsController: AdminStatisticsController,
    businessDashboardController: BusinessDashboardController,
    consultantDashboardController: ConsultantDashboardController,
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
      {
        prefix: 'businessDashboard',
        instance: businessDashboardController,
        methods: {
          getSummary: (): Promise<unknown[]> => Promise.resolve([]),
          getActionItems: (): Promise<unknown[]> => Promise.resolve([]),
          getSpendTrend: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getProjectHealth: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          getTeamPerformance: (req): Promise<unknown[]> =>
            Promise.resolve([this.parseJsonBody(req)]),
        },
      },
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
