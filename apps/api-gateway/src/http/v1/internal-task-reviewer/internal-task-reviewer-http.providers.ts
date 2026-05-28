import { TaskReviewsClient } from '@/clients/v1/internal-task-reviewer';
import { provideGrpcServiceProxy } from '@/http/v1/shared/grpc-service-proxy.util';
import {
  TaskReviewQueryService,
  TaskReviewVotingService,
} from '@/http/v1/shared/grpc-service-tokens';

export const INTERNAL_TASK_REVIEWER_HTTP_PROVIDERS = [
  provideGrpcServiceProxy(TaskReviewQueryService, TaskReviewsClient, 'taskReviews'),
  provideGrpcServiceProxy(TaskReviewVotingService, TaskReviewsClient, 'taskReviews', {
    submitVote: 'taskReviews.vote',
  }),
];
