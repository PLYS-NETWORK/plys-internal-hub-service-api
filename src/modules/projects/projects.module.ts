import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ConsultantProjectController } from './consultant-project.controller';
import { ConsultantProjectService } from './services/consultant-project.service';

/**
 * Consultant-side project discovery (`/projects-consultant`). The business
 * side moved to `BusinessProjectsModule` (`/projects/business`); this module
 * keeps only the read-only consultant flow.
 */
@Module({
  imports: [UnitOfWorkModule],
  controllers: [ConsultantProjectController],
  providers: [ConsultantProjectService],
  exports: [ConsultantProjectService],
})
export class ProjectsModule {}
