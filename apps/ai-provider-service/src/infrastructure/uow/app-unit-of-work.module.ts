import { Module } from '@nestjs/common';
import { ProjectsUnitOfWorkModule } from '@plys/libraries/unit-of-work/projects-unit-of-work.module';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

@Module({
  imports: [ProjectsUnitOfWorkModule, UnitOfWorkModule],
  exports: [ProjectsUnitOfWorkModule, UnitOfWorkModule],
})
export class AppUnitOfWorkModule {}
