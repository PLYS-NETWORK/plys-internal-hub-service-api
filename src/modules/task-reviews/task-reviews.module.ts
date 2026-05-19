import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { TaskAiReviewHandler } from './handlers/task-ai-review.handler';
import { AiQualityCheckService } from './services/ai-quality-check.service';
import { TaskCompletionService } from './services/task-completion.service';
import { TaskReviewAssignmentService } from './services/task-review-assignment.service';
import { TaskReviewQueryService } from './services/task-review-query.service';
import { TaskReviewVotingService } from './services/task-review-voting.service';
import { TaskReviewsController } from './task-reviews.controller';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [TaskReviewsController],
  providers: [
    TaskReviewAssignmentService,
    TaskReviewVotingService,
    TaskCompletionService,
    TaskReviewQueryService,
    AiQualityCheckService,
    TaskAiReviewHandler,
  ],
  exports: [TaskReviewAssignmentService, TaskCompletionService],
})
export class TaskReviewsModule {}
