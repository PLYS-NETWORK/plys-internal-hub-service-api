import { EmailModule } from '@common/modules/email';
import { EnvironmentsModule } from '@common/modules/environments';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { forwardRef, Module } from '@nestjs/common';

import { BacklogsController } from './controllers/backlogs.controller';
import { BoardController } from './controllers/board.controller';
import { BusinessProjectOverviewController } from './controllers/overview.controller';
import { BusinessProjectsController } from './controllers/projects.controller';
import { SettingsController } from './controllers/settings.controller';
import { BacklogsService } from './services/backlogs.service';
import { BoardService } from './services/board/board.service';
import { BoardEvidencesService } from './services/board/board-evidences.service';
import { BoardHistoryService } from './services/board/board-history.service';
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
    BoardHistoryService,
    BoardEvidencesService,
  ],
  exports: [BusinessAccessService, ProjectStatusService],
})
export class BusinessProjectsModule {}
