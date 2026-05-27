import { Module } from '@nestjs/common';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis/redis.module';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import {
  AdminDashboardSummaryService,
  AdminGrowthTrendService,
  AdminOperationalQueuesService,
  AdminUsersBreakdownService,
} from './admin/services';
import {
  BusinessActionItemsService,
  BusinessDashboardSummaryService,
  BusinessProjectHealthService,
  BusinessSpendTrendService,
  BusinessTeamPerformanceService,
} from './business/dashboard/services';
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
  controllers: [],
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
  exports: [
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
