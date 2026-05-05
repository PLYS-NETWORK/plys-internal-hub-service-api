import { BusinessProjectsModule } from '@modules/business-projects/business-projects.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ChatSessionsController } from './controllers/chat-sessions.controller';
import { ProjectSessionsController } from './controllers/project-sessions.controller';
import { ProjectChatSessionService } from './project-chat-session.service';

// Step C-3 wiring. BusinessProjectsModule is imported for `BusinessAccessService`,
// the canonical tenant guard for project-scoped reads/writes. The service is
// exported so the upcoming AiBootstrap and AiContext modules can compose it
// without re-implementing the session lookup.
@Module({
  imports: [UnitOfWorkModule, BusinessProjectsModule],
  controllers: [ProjectSessionsController, ChatSessionsController],
  providers: [ProjectChatSessionService],
  exports: [ProjectChatSessionService],
})
export class ProjectChatSessionModule {}
