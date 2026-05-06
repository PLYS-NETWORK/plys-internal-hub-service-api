import { FileStorageModule } from '@common/modules/file-storage';
import { BusinessProjectsModule } from '@modules/business-projects/business-projects.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ConsultantBoardController } from './controllers/board.controller';
import { ConsultantOverviewController } from './controllers/overview.controller';
import { ConsultantProjectsController } from './controllers/projects.controller';
import { ConsultantBoardService } from './services/board/board.service';
import { ConsultantBoardResultsService } from './services/board/board-results.service';
import { ConsultantAccessService } from './services/consultant-access.service';
import { ConsultantOverviewService } from './services/overview.service';
import { ConsultantProjectsService } from './services/projects.service';

/**
 * Consultant-side projects surface (`/projects/consultant/...`). Mirrors
 * `BusinessProjectsModule` in structure; the read-only discovery flow that
 * used to live in `ProjectsModule` (`/projects-consultant`) has been folded
 * into `ConsultantProjectsService` here.
 */
@Module({
  imports: [UnitOfWorkModule, FileStorageModule, BusinessProjectsModule],
  controllers: [
    ConsultantProjectsController,
    ConsultantOverviewController,
    ConsultantBoardController,
  ],
  providers: [
    ConsultantAccessService,
    ConsultantProjectsService,
    ConsultantOverviewService,
    ConsultantBoardService,
    ConsultantBoardResultsService,
  ],
})
export class ConsultantProjectsModule {}
