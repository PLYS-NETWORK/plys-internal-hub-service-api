import { EmailModule } from '@common/modules/email';
import { EnvironmentsModule } from '@common/modules/environments';
import { FileStorageModule } from '@common/modules/file-storage';
import { RedisModule } from '@common/modules/redis/redis.module';
import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { forwardRef, Module } from '@nestjs/common';

import { AiSyncController } from './controllers/ai-sync.controller';
import { BacklogsController } from './controllers/backlogs.controller';
import { BoardController } from './controllers/board.controller';
import { BusinessProjectOverviewController } from './controllers/overview.controller';
import { BusinessProjectsController } from './controllers/projects.controller';
import { SettingsController } from './controllers/settings.controller';
import { TaskAttachmentsController } from './controllers/task-attachments.controller';
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
    UnitOfWorkModule,
    EmailModule,
    EnvironmentsModule,
    FileStorageModule,
    RedisModule,
    // forwardRef breaks the cycle: ProjectAiContextModule imports
    // BusinessProjectsModule for BusinessAccessService.
    forwardRef(() => ProjectAiContextModule),
  ],
  controllers: [
    BusinessProjectsController,
    BusinessProjectOverviewController,
    BacklogsController,
    SettingsController,
    BoardController,
    TaskAttachmentsController,
    AiSyncController,
  ],
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
  exports: [BusinessAccessService, BoardCacheService, ProjectStatusService],
})
export class BusinessProjectsModule {}
