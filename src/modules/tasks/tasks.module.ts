import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { BusinessTaskStatusStrategy } from './business/business-task-status.strategy';
import { BusinessTasksService } from './business/business-tasks.service';
import { TasksBusinessController } from './business/tasks-business.controller';
import { ConsultantTaskStatusStrategy } from './consultant/consultant-task-status.strategy';
import { ConsultantTasksService } from './consultant/consultant-tasks.service';
import { TasksConsultantController } from './consultant/tasks-consultant.controller';
import { TaskAccessService } from './shared/services/task-access.service';
import { TaskCommentsService } from './shared/services/task-comments.service';
import { TaskEvidencesService } from './shared/services/task-evidences.service';
import { TaskMapperService } from './shared/services/task-mapper.service';
import { TaskPaymentService } from './shared/services/task-payment.service';
import { TasksController } from './shared/tasks.controller';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [TasksController, TasksBusinessController, TasksConsultantController],
  providers: [
    // shared
    TaskAccessService,
    TaskMapperService,
    TaskPaymentService,
    TaskCommentsService,
    TaskEvidencesService,
    // business
    BusinessTasksService,
    BusinessTaskStatusStrategy,
    // consultant
    ConsultantTasksService,
    ConsultantTaskStatusStrategy,
  ],
})
export class TasksModule {}
