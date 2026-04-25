import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { TaskCommentsService } from './services/task-comments.service';
import { TaskOperationsService } from './services/task-operations.service';
import { TasksBusinessController } from './tasks-business.controller';
import { TasksConsultantController } from './tasks-consultant.controller';
import { TasksController } from './tasks.controller';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [TasksController, TasksBusinessController, TasksConsultantController],
  providers: [TaskOperationsService, TaskCommentsService],
})
export class TasksModule {}
