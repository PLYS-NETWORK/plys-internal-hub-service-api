import { TaskReviewsController } from '@modules/task-reviews/task-reviews.controller';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

export const GRPC_HTTP_PROVIDERS = [controllerProvider(TaskReviewsController)];
