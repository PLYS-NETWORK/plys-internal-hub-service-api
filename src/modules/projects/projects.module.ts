import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { BusinessProjectController } from './business-project.controller';
import { ConsultantProjectController } from './consultant-project.controller';
import { BusinessProjectService } from './services/business-project.service';
import { ConsultantProjectService } from './services/consultant-project.service';
import { ProjectInterviewQuestionsService } from './services/project-interview-questions.service';
import { ProjectRequiredSkillsService } from './services/project-required-skills.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [BusinessProjectController, ConsultantProjectController],
  providers: [
    BusinessProjectService,
    ConsultantProjectService,
    ProjectInterviewQuestionsService,
    ProjectRequiredSkillsService,
  ],
  exports: [BusinessProjectService, ConsultantProjectService],
})
export class ProjectsModule {}
