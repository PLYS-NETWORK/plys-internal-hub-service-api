import { BusinessProjectsModule } from '@modules/business-projects/business-projects.module';
import { ProjectChatSessionModule } from '@modules/project-chat-session/project-chat-session.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { AiBootstrapController } from './ai-bootstrap.controller';
import { AiBootstrapService } from './ai-bootstrap.service';

// Step C-3 read aggregator. Composes BusinessAccessService (project ownership
// gate) and ProjectChatSessionService (session list) on top of the UoW reads
// for tasks / context / skills. No writes here — the AI context lazy-create
// is C-4 territory.
@Module({
  imports: [UnitOfWorkModule, BusinessProjectsModule, ProjectChatSessionModule],
  controllers: [AiBootstrapController],
  providers: [AiBootstrapService],
})
export class AiBootstrapModule {}
