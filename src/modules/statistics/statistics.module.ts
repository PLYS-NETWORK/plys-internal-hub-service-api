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
import { BusinessDashboardController } from './business/dashboard/business-dashboard.controller';
import {
  BusinessActionItemsService,
  BusinessDashboardSummaryService,
  BusinessProjectHealthService,
  BusinessSpendTrendService,
  BusinessTeamPerformanceService,
} from './business/dashboard/services';

/**
 * Read-only dashboard endpoints for both platforms.
 *
 * - `/business/dashboard/*` — owner-focused KPIs (money, portfolio, throughput,
 *   team, action items) backed by a per-business Redis cache.
 * - `/admin/dashboard/*` — platform-wide KPIs (users, financial, queues,
 *   growth) backed by a global Redis cache.
 */
@Module({
  imports: [UnitOfWorkModule, RedisModule],
  controllers: [BusinessDashboardController, AdminStatisticsController],
  providers: [
    BusinessDashboardSummaryService,
    BusinessActionItemsService,
    BusinessSpendTrendService,
    BusinessProjectHealthService,
    BusinessTeamPerformanceService,
    AdminDashboardSummaryService,
    AdminUsersBreakdownService,
    AdminGrowthTrendService,
    AdminOperationalQueuesService,
  ],
})
export class StatisticsModule {}
