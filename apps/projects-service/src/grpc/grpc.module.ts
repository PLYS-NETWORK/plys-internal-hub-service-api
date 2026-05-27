import { AiBootstrapModule } from '@modules/ai-bootstrap/ai-bootstrap.module';
import { BusinessProjectsModule } from '@modules/business-projects/business-projects.module';
import { ConsultantProjectsModule } from '@modules/consultant-projects/consultant-projects.module';
import { ExploreModule } from '@modules/explore/explore.module';
import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { ProjectChatSessionModule } from '@modules/project-chat-session/project-chat-session.module';
import { TaskReviewsModule } from '@modules/task-reviews/task-reviews.module';
import { Module } from '@nestjs/common';
import { AiProviderKeyModule } from '@plys/libraries/ai-provider-key';

/** Feature imports for gRPC bridge HTTP controllers registered on AppModule. */
@Module({
  imports: [
    BusinessProjectsModule,
    ConsultantProjectsModule,
    ExploreModule,
    TaskReviewsModule,
    AiProviderKeyModule,
    ProjectAiContextModule,
    AiBootstrapModule,
    ProjectChatSessionModule,
  ],
})
export class GrpcModule {}
