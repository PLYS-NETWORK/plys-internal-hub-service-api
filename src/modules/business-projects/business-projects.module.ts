import { EmailModule } from '@common/modules/email';
import { EnvironmentsModule } from '@common/modules/environments';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ApplicationsController } from './controllers/applications.controller';
import { BacklogsController } from './controllers/backlogs.controller';
import { BoardController } from './controllers/board.controller';
import { BusinessProjectOverviewController } from './controllers/overview.controller';
import { BusinessProjectsController } from './controllers/projects.controller';
import { SettingsController } from './controllers/settings.controller';
import { ApplicationsService } from './services/applications.service';
import { BacklogsService } from './services/backlogs.service';
import { BoardService } from './services/board/board.service';
import { BoardCommentsService } from './services/board/board-comments.service';
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
  imports: [UnitOfWorkModule, EmailModule, EnvironmentsModule, NotificationsModule],
  controllers: [
    BusinessProjectsController,
    BusinessProjectOverviewController,
    BacklogsController,
    SettingsController,
    ApplicationsController,
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
    ApplicationsService,
    BoardService,
    BoardCommentsService,
    BoardHistoryService,
    BoardEvidencesService,
  ],
  exports: [ProjectStatusService],
})
export class BusinessProjectsModule {}
