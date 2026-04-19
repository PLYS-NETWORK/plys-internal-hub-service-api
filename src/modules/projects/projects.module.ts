import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ProjectsController } from './projects.controller';
import { BusinessProjectService } from './services/business-project.service';
import { ConsultantProjectService } from './services/consultant-project.service';
import { ProjectRequiredSkillsService } from './services/project-required-skills.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [ProjectsController],
  providers: [BusinessProjectService, ConsultantProjectService, ProjectRequiredSkillsService],
  exports: [BusinessProjectService, ConsultantProjectService],
})
export class ProjectsModule {}
