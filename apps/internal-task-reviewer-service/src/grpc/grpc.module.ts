import { TaskReviewsModule } from '@modules/task-reviews/task-reviews.module';
import { Module } from '@nestjs/common';

/** Feature imports for gRPC bridge HTTP controllers registered on AppModule. */
@Module({
  imports: [TaskReviewsModule],
})
export class GrpcModule {}
