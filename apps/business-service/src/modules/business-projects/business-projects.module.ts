import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { forwardRef, Module } from '@nestjs/common';
import { EmailModule } from '@plys/libraries/common-nest/modules/email';
import { EnvironmentsModule } from '@plys/libraries/common-nest/modules/environments';
import { FileStorageModule } from '@plys/libraries/common-nest/modules/file-storage';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis/redis.module';
import { ProjectsUnitOfWorkModule } from '@plys/libraries/unit-of-work/projects-unit-of-work.module';

import { ProfilesPortModule } from '../../infrastructure/profiles-port/profiles-port.module';
import { BacklogsService } from './services/backlogs.service';
import { BoardService } from './services/board/board.service';
import { BoardCacheService } from './services/board/board-cache.service';
import { BoardHistoryService } from './services/board/board-history.service';
import { BoardMilestonesService } from './services/board/board-milestones.service';
import { BoardResultsService } from './services/board/board-results.service';
import { BusinessAccessService } from './services/business-access.service';
import { BusinessProjectOverviewService } from './services/overview.service';
import { ProjectPublishService } from './services/projects/project-publish.service';
import { ProjectRepublishService } from './services/projects/project-republish.service';
import { ProjectStatusService } from './services/projects/project-status.service';
import { BusinessProjectsService } from './services/projects/projects.service';
import { SettingsService } from './services/settings.service';
import { TaskAttachmentsService } from './services/task-attachments.service';

@Module({
  imports: [
    ProjectsUnitOfWorkModule,
    ProfilesPortModule,
    EmailModule,
    EnvironmentsModule,
    FileStorageModule,
    RedisModule,
    // forwardRef breaks the cycle: ProjectAiContextModule imports
    // BusinessProjectsModule for BusinessAccessService.
    forwardRef(() => ProjectAiContextModule),
  ],
  controllers: [],
  providers: [
    BusinessAccessService,
    BusinessProjectsService,
    ProjectPublishService,
    ProjectRepublishService,
    ProjectStatusService,
    BusinessProjectOverviewService,
    BacklogsService,
    SettingsService,
    BoardService,
    BoardCacheService,
    BoardHistoryService,
    BoardResultsService,
    TaskAttachmentsService,
    BoardMilestonesService,
  ],
  exports: [
    BusinessAccessService,
    BoardCacheService,
    ProjectStatusService,
    BusinessProjectsService,
    ProjectPublishService,
    ProjectRepublishService,
    BusinessProjectOverviewService,
    BacklogsService,
    SettingsService,
    BoardService,
    BoardHistoryService,
    BoardResultsService,
    TaskAttachmentsService,
    BoardMilestonesService,
  ],
})
export class BusinessProjectsModule {}
