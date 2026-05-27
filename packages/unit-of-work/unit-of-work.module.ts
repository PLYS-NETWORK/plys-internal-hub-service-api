import { Module } from '@nestjs/common';

import { ProjectsUnitOfWorkModule } from './projects-unit-of-work.module';
import { ProjectsUnitOfWorkService } from './projects-unit-of-work.service';
import { UnitOfWorkService } from './unit-of-work.service';

/** @deprecated Prefer ProfilesUnitOfWorkModule or ProjectsUnitOfWorkModule. */
@Module({
  imports: [ProjectsUnitOfWorkModule],
  providers: [{ provide: UnitOfWorkService, useExisting: ProjectsUnitOfWorkService }],
  exports: [UnitOfWorkService, ProjectsUnitOfWorkModule],
})
export class UnitOfWorkModule {}
