import { Module } from '@nestjs/common';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis/redis.module';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import {
  ConsultantActionItemsService,
  ConsultantDashboardSummaryService,
  ConsultantEarningsTrendService,
  ConsultantProjectProgressService,
  ConsultantSkillPerformanceService,
} from './consultant/dashboard/services';

@Module({
  imports: [UnitOfWorkModule, RedisModule],
  controllers: [],
  providers: [
    ConsultantDashboardSummaryService,
    ConsultantActionItemsService,
    ConsultantEarningsTrendService,
    ConsultantProjectProgressService,
    ConsultantSkillPerformanceService,
  ],
  exports: [
    ConsultantDashboardSummaryService,
    ConsultantActionItemsService,
    ConsultantEarningsTrendService,
    ConsultantProjectProgressService,
    ConsultantSkillPerformanceService,
  ],
})
export class StatisticsModule {}
