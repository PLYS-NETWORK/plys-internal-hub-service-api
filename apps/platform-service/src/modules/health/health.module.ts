import { Module } from '@nestjs/common';

import { HealthService } from './health.service';

@Module({
  controllers: [],
  providers: [HealthService],
})
export class HealthModule {}
