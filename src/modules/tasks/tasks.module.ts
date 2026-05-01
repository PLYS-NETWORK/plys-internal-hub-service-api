import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ConsultantTaskStatusStrategy } from './consultant/consultant-task-status.strategy';
import { ConsultantTasksService } from './consultant/consultant-tasks.service';
import { TasksConsultantController } from './consultant/tasks-consultant.controller';
import { TaskAccessService } from './shared/services/task-access.service';
import { TaskCommentsService } from './shared/services/task-comments.service';
import { TaskEvidencesService } from './shared/services/task-evidences.service';
import { TaskMapperService } from './shared/services/task-mapper.service';
import { TaskPaymentService } from './shared/services/task-payment.service';
import { TasksController } from './shared/tasks.controller';

/**
 * The business-side task surface lives under `BusinessProjectsModule`
 * (`/projects/business/:id/board/...`). This module keeps only the
 * shared-ownership endpoints (single-task lookups, comments, evidences) and
 * the consultant flow.
 */
@Module({
  imports: [UnitOfWorkModule],
  controllers: [TasksController, TasksConsultantController],
  providers: [
    // shared
    TaskAccessService,
    TaskMapperService,
    TaskPaymentService,
    TaskCommentsService,
    TaskEvidencesService,
    // consultant
    ConsultantTasksService,
    ConsultantTaskStatusStrategy,
  ],
})
export class TasksModule {}
