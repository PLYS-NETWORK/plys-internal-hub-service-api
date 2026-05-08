import { BusinessProjectsModule } from '@modules/business-projects/business-projects.module';
import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ChatSessionsController } from './controllers/chat-sessions.controller';
import { ProjectSessionsController } from './controllers/project-sessions.controller';
import { ProjectChatSessionService } from './project-chat-session.service';

// Step C-3 wiring (extended in C-4). BusinessProjectsModule provides the
// canonical tenant guard `BusinessAccessService`; ProjectAiContextModule
// provides `ensureExists` so a session never exists without its context row.
// The service is exported so AiBootstrap can compose it without re-
// implementing the session lookup.
@Module({
  imports: [UnitOfWorkModule, BusinessProjectsModule, ProjectAiContextModule],
  controllers: [ProjectSessionsController, ChatSessionsController],
  providers: [ProjectChatSessionService],
  exports: [ProjectChatSessionService],
})
export class ProjectChatSessionModule {}
