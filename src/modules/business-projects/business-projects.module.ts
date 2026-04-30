import { EmailModule } from '@common/modules/email';
import { EnvironmentsModule } from '@common/modules/environments';
import { ProjectsModule } from '@modules/projects/projects.module';
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
import { BusinessProjectsService } from './services/projects.service';
import { SettingsService } from './services/settings.service';

@Module({
  imports: [
    UnitOfWorkModule,
    EmailModule,
    EnvironmentsModule,
    // Imported for the publish-flow delegation in BusinessProjectsService.
    // When the legacy ProjectsModule is decommissioned, the publish/validate
    // logic should be inlined here and this import dropped.
    ProjectsModule,
  ],
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
    BusinessProjectOverviewService,
    BacklogsService,
    SettingsService,
    ApplicationsService,
    BoardService,
    BoardCommentsService,
    BoardHistoryService,
    BoardEvidencesService,
  ],
})
export class BusinessProjectsModule {}
