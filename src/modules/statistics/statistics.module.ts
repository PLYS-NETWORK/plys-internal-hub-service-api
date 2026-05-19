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
import { ConsultantDashboardController } from './consultant/dashboard/consultant-dashboard.controller';
import {
  ConsultantActionItemsService,
  ConsultantDashboardSummaryService,
  ConsultantEarningsTrendService,
  ConsultantProjectProgressService,
  ConsultantSkillPerformanceService,
} from './consultant/dashboard/services';

/**
 * Read-only dashboard endpoints for the three platforms.
 *
 * - `/business/dashboard/*` — owner-focused KPIs (money, portfolio, throughput,
 *   team, action items) backed by a per-business Redis cache.
 * - `/consultant/dashboard/*` — freelancer-focused KPIs (earnings, portfolio,
 *   performance, skills, exams, onboarding, action items) backed by a
 *   per-consultant Redis cache.
 * - `/admin/dashboard/*` — platform-wide KPIs (users, financial, queues,
 *   growth) backed by a global Redis cache.
 */
@Module({
  imports: [UnitOfWorkModule, RedisModule],
  controllers: [
    BusinessDashboardController,
    AdminStatisticsController,
    ConsultantDashboardController,
  ],
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
    ConsultantDashboardSummaryService,
    ConsultantActionItemsService,
    ConsultantEarningsTrendService,
    ConsultantProjectProgressService,
    ConsultantSkillPerformanceService,
  ],
})
export class StatisticsModule {}
