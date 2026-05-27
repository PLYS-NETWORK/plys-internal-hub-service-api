import { BusinessProjectsModule } from '@modules/business-projects/business-projects.module';
import { forwardRef, Module } from '@nestjs/common';
import { ProjectsUnitOfWorkModule } from '@plys/libraries/unit-of-work/projects-unit-of-work.module';

import { ProjectAiContextService } from './project-ai-context.service';

// Step C-4 wiring. Exports the service so:
//   - BacklogsService can call `patchTaskInIndex` / `removeManyFromIndex`
//     inside its task CRUD transactions.
//   - ProjectChatSessionService can call `ensureExists` from createSession.
//   - The AI bootstrap module can read the row (already does so via UoW
//     directly; switching is a follow-up).
@Module({
  imports: [
    ProjectsUnitOfWorkModule,
    // forwardRef breaks the cycle: BusinessProjectsModule imports
    // ProjectAiContextModule so BacklogsService can hook the index.
    forwardRef(() => BusinessProjectsModule),
  ],
  controllers: [],
  providers: [ProjectAiContextService],
  exports: [ProjectAiContextService],
})
export class ProjectAiContextModule {}
