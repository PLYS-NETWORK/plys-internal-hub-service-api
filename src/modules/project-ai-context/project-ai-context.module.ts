import { BusinessProjectsModule } from '@modules/business-projects/business-projects.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { forwardRef, Module } from '@nestjs/common';

import { ProjectAiContextController } from './project-ai-context.controller';
import { ProjectAiContextService } from './project-ai-context.service';
import { ProjectAiContextAdminController } from './project-ai-context-admin.controller';

// Step C-4 wiring. Exports the service so:
//   - BacklogsService can call `patchTaskInIndex` / `removeManyFromIndex`
//     inside its task CRUD transactions.
//   - ProjectChatSessionService can call `ensureExists` from createSession.
//   - The AI bootstrap module can read the row (already does so via UoW
//     directly; switching is a follow-up).
@Module({
  imports: [
    UnitOfWorkModule,
    // forwardRef breaks the cycle: BusinessProjectsModule imports
    // ProjectAiContextModule so BacklogsService can hook the index.
    forwardRef(() => BusinessProjectsModule),
  ],
  controllers: [ProjectAiContextController, ProjectAiContextAdminController],
  providers: [ProjectAiContextService],
  exports: [ProjectAiContextService],
})
export class ProjectAiContextModule {}
