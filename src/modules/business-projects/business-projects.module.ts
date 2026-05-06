import { EmailModule } from '@common/modules/email';
import { EnvironmentsModule } from '@common/modules/environments';
import { FileStorageModule } from '@common/modules/file-storage';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { forwardRef, Module } from '@nestjs/common';

import { AiSyncController } from './controllers/ai-sync.controller';
import { BacklogsController } from './controllers/backlogs.controller';
import { BoardController } from './controllers/board.controller';
import { BusinessProjectOverviewController } from './controllers/overview.controller';
import { BusinessProjectsController } from './controllers/projects.controller';
import { SettingsController } from './controllers/settings.controller';
import { BacklogsService } from './services/backlogs.service';
import { BoardService } from './services/board/board.service';
import { BoardAttachmentsService } from './services/board/board-attachments.service';
import { BoardCacheService } from './services/board/board-cache.service';
import { BoardHistoryService } from './services/board/board-history.service';
import { BoardResultsService } from './services/board/board-results.service';
import { BusinessAccessService } from './services/business-access.service';
import { BusinessProjectOverviewService } from './services/overview.service';
import { ProjectPublishService } from './services/projects/project-publish.service';
import { ProjectRepublishService } from './services/projects/project-republish.service';
import { ProjectStatusService } from './services/projects/project-status.service';
import { BusinessProjectsService } from './services/projects/projects.service';
import { SettingsService } from './services/settings.service';

@Module({
  imports: [
    UnitOfWorkModule,
    EmailModule,
    EnvironmentsModule,
    FileStorageModule,
    NotificationsModule,
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
    BoardAttachmentsService,
  ],
  exports: [BusinessAccessService, BoardCacheService, ProjectStatusService],
})
export class BusinessProjectsModule {}
