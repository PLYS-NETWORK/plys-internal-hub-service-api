import { Module } from '@nestjs/common';

import { InternalTaskReviewerClientsModule } from '@/clients/v1/internal-task-reviewer';

import { TaskReviewsController } from './controllers/task-reviews.controller';
import { INTERNAL_TASK_REVIEWER_HTTP_PROVIDERS } from './internal-task-reviewer-http.providers';

@Module({
  imports: [InternalTaskReviewerClientsModule],
  controllers: [TaskReviewsController],
  providers: INTERNAL_TASK_REVIEWER_HTTP_PROVIDERS,
})
export class InternalTaskReviewerHttpModule {}
