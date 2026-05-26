import { BusinessProjectsModule } from '@modules/business-projects/business-projects.module';
import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { Module } from '@nestjs/common';
import { ProjectsUnitOfWorkModule } from '@plys/libraries/unit-of-work/projects-unit-of-work.module';

import { ProjectChatSessionService } from './project-chat-session.service';

// Step C-3 wiring (extended in C-4). BusinessProjectsModule provides the
// canonical tenant guard `BusinessAccessService`; ProjectAiContextModule
// provides `ensureExists` so a session never exists without its context row.
// The service is exported so AiBootstrap can compose it without re-
// implementing the session lookup.
@Module({
  imports: [ProjectsUnitOfWorkModule, BusinessProjectsModule, ProjectAiContextModule],
  controllers: [],
  providers: [ProjectChatSessionService],
  exports: [ProjectChatSessionService],
})
export class ProjectChatSessionModule {}
