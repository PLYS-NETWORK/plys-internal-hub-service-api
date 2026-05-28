import { Module } from '@nestjs/common';
import { ProjectsUnitOfWorkModule } from '@plys/libraries/unit-of-work/projects-unit-of-work.module';

import { ProfilesPortModule } from '../../infrastructure/profiles-port/profiles-port.module';
import { TaskAiReviewHandler } from './handlers/task-ai-review.handler';
import { AiQualityCheckService } from './services/ai-quality-check.service';
import { TaskCompletionService } from './services/task-completion.service';
import { TaskReviewAssignmentService } from './services/task-review-assignment.service';
import { TaskReviewQueryService } from './services/task-review-query.service';
import { TaskReviewVotingService } from './services/task-review-voting.service';

@Module({
  imports: [ProjectsUnitOfWorkModule, ProfilesPortModule],
  controllers: [],
  providers: [
    TaskReviewAssignmentService,
    TaskReviewVotingService,
    TaskCompletionService,
    TaskReviewQueryService,
    AiQualityCheckService,
    TaskAiReviewHandler,
  ],
  exports: [
    TaskReviewAssignmentService,
    TaskCompletionService,
    TaskReviewQueryService,
    TaskReviewVotingService,
  ],
})
export class TaskReviewsModule {}
