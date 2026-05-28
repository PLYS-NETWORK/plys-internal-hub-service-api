import { Module } from '@nestjs/common';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis/redis.module';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import {
  AdminDashboardSummaryService,
  AdminGrowthTrendService,
  AdminOperationalQueuesService,
  AdminUsersBreakdownService,
} from './admin/services';

@Module({
  imports: [UnitOfWorkModule, RedisModule],
  controllers: [],
  providers: [
    AdminDashboardSummaryService,
    AdminUsersBreakdownService,
    AdminGrowthTrendService,
    AdminOperationalQueuesService,
  ],
  exports: [
    AdminDashboardSummaryService,
    AdminUsersBreakdownService,
    AdminGrowthTrendService,
    AdminOperationalQueuesService,
  ],
})
export class StatisticsModule {}
