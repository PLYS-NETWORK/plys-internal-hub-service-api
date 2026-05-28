import { Module } from '@nestjs/common';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

@Module({
  imports: [UnitOfWorkModule],
  exports: [UnitOfWorkModule],
})
export class AppUnitOfWorkModule {}
