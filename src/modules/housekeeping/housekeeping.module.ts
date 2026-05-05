import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { HOUSEKEEPING_QUEUE } from './housekeeping.constants';
import { HousekeepingProcessor } from './housekeeping.processor';
import { HousekeepingScheduler } from './housekeeping.scheduler';

// Step C-5 wiring. BullModule.forRoot is in AppModule (it owns the Redis
// connection); this module only registers the housekeeping queue and the
// processor + scheduler that feed it.
@Module({
  imports: [UnitOfWorkModule, BullModule.registerQueue({ name: HOUSEKEEPING_QUEUE })],
  providers: [HousekeepingProcessor, HousekeepingScheduler],
})
export class HousekeepingModule {}
