import { Module } from '@nestjs/common';
import { ProfilesUnitOfWorkModule } from '@plys/libraries/unit-of-work/profiles-unit-of-work.module';
import { ProjectsUnitOfWorkModule } from '@plys/libraries/unit-of-work/projects-unit-of-work.module';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

/** Scoped UoW wiring for business-service (shared DB, packages/unit-of-work). */
@Module({
  imports: [ProfilesUnitOfWorkModule, ProjectsUnitOfWorkModule, UnitOfWorkModule],
  exports: [ProfilesUnitOfWorkModule, ProjectsUnitOfWorkModule, UnitOfWorkModule],
})
export class AppUnitOfWorkModule {}
