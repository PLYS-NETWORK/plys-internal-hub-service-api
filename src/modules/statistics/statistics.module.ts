import { RedisModule } from '@common/modules/redis/redis.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { AdminStatisticsController } from './admin/admin-statistics.controller';
import {
  AdminDashboardSummaryService,
  AdminGrowthTrendService,
  AdminOperationalQueuesService,
  AdminUsersBreakdownService,
} from './admin/services';
import { BusinessStatisticsController } from './business/business-statistics.controller';
import { BusinessStatisticsScope } from './business/scopes/business-statistics.scope';
import { BusinessBillingStatisticsService } from './business/services/business-billing-statistics.service';
import { BusinessDashboardSummaryService } from './business/services/business-dashboard-summary.service';
import { BusinessProjectStatisticsService } from './business/services/business-project-statistics.service';
import { BusinessTaskStatisticsService } from './business/services/business-task-statistics.service';

/**
 * Read-only dashboard statistics. The BUSINESS-platform endpoints live under
 * `business/` and use the scope-strategy pattern in `shared/services/abstract-*`.
 * The ADMIN dashboard endpoints under `admin/` aggregate platform-wide and
 * cache the heavy reads in Redis — hence the additional `RedisModule` import.
 */
@Module({
  imports: [UnitOfWorkModule, RedisModule],
  controllers: [BusinessStatisticsController, AdminStatisticsController],
  providers: [
    BusinessStatisticsScope,
    BusinessProjectStatisticsService,
    BusinessTaskStatisticsService,
    BusinessBillingStatisticsService,
    BusinessDashboardSummaryService,
    AdminDashboardSummaryService,
    AdminUsersBreakdownService,
    AdminGrowthTrendService,
    AdminOperationalQueuesService,
  ],
})
export class StatisticsModule {}
