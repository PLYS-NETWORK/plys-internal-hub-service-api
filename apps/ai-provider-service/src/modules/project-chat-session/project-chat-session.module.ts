import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { Module } from '@nestjs/common';
import { ProjectsUnitOfWorkModule } from '@plys/libraries/unit-of-work/projects-unit-of-work.module';

import { BusinessAccessModule } from '../../infrastructure/business-access/business-access.module';
import { ProjectChatSessionService } from './project-chat-session.service';

// Step C-3 wiring (extended in C-4). BusinessAccessModule provides the
// canonical tenant guard `BusinessAccessService`; ProjectAiContextModule
// provides `ensureExists` so a session never exists without its context row.
// The service is exported so AiBootstrap can compose it without re-
// implementing the session lookup.
@Module({
  imports: [ProjectsUnitOfWorkModule, BusinessAccessModule, ProjectAiContextModule],
  controllers: [],
  providers: [ProjectChatSessionService],
  exports: [ProjectChatSessionService],
})
export class ProjectChatSessionModule {}
