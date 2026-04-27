import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { BusinessStatisticsController } from './business/business-statistics.controller';
import { BusinessStatisticsScope } from './business/scopes/business-statistics.scope';
import { BusinessApplicationStatisticsService } from './business/services/business-application-statistics.service';
import { BusinessBillingStatisticsService } from './business/services/business-billing-statistics.service';
import { BusinessDashboardSummaryService } from './business/services/business-dashboard-summary.service';
import { BusinessProjectStatisticsService } from './business/services/business-project-statistics.service';
import { BusinessTaskStatisticsService } from './business/services/business-task-statistics.service';

/**
 * Read-only dashboard statistics for the BUSINESS platform. Built on a
 * scope-strategy pattern so consultant + admin variants can drop in later
 * without duplicating any aggregation SQL — see `shared/services/abstract-*`.
 */
@Module({
  imports: [UnitOfWorkModule],
  controllers: [BusinessStatisticsController],
  providers: [
    BusinessStatisticsScope,
    BusinessProjectStatisticsService,
    BusinessTaskStatisticsService,
    BusinessApplicationStatisticsService,
    BusinessBillingStatisticsService,
    BusinessDashboardSummaryService,
  ],
})
export class StatisticsModule {}
