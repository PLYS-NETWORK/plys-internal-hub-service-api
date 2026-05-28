import { Module } from '@nestjs/common';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis/redis.module';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import {
  BusinessActionItemsService,
  BusinessDashboardSummaryService,
  BusinessProjectHealthService,
  BusinessSpendTrendService,
  BusinessTeamPerformanceService,
} from './business/dashboard/services';

@Module({
  imports: [UnitOfWorkModule, RedisModule],
  controllers: [],
  providers: [
    BusinessDashboardSummaryService,
    BusinessActionItemsService,
    BusinessSpendTrendService,
    BusinessProjectHealthService,
    BusinessTeamPerformanceService,
  ],
  exports: [
    BusinessDashboardSummaryService,
    BusinessActionItemsService,
    BusinessSpendTrendService,
    BusinessProjectHealthService,
    BusinessTeamPerformanceService,
  ],
})
export class StatisticsModule {}
