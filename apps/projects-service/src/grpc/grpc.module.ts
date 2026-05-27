import { AiBootstrapController } from '@modules/ai-bootstrap/ai-bootstrap.controller';
import { AiBootstrapModule } from '@modules/ai-bootstrap/ai-bootstrap.module';
import { BusinessProjectsModule } from '@modules/business-projects/business-projects.module';
import { AiSyncController } from '@modules/business-projects/controllers/ai-sync.controller';
import { BacklogsController } from '@modules/business-projects/controllers/backlogs.controller';
import { BoardController } from '@modules/business-projects/controllers/board.controller';
import { BusinessProjectOverviewController } from '@modules/business-projects/controllers/overview.controller';
import { BusinessProjectsController } from '@modules/business-projects/controllers/projects.controller';
import { SettingsController } from '@modules/business-projects/controllers/settings.controller';
import { TaskAttachmentsController } from '@modules/business-projects/controllers/task-attachments.controller';
import { ConsultantProjectsModule } from '@modules/consultant-projects/consultant-projects.module';
import { ConsultantExploreController } from '@modules/consultant-projects/controllers/consultant-explore.controller';
import { ConsultantJoinedProjectsController } from '@modules/consultant-projects/controllers/consultant-joined-projects.controller';
import { ConsultantMembershipController } from '@modules/consultant-projects/controllers/consultant-membership.controller';
import { ConsultantProjectTasksController } from '@modules/consultant-projects/controllers/consultant-project-tasks.controller';
import { ExploreController } from '@modules/explore/explore.controller';
import { ExploreModule } from '@modules/explore/explore.module';
import { ProjectAiContextController } from '@modules/project-ai-context/project-ai-context.controller';
import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { ProjectAiContextAdminController } from '@modules/project-ai-context/project-ai-context-admin.controller';
import { ChatSessionsController } from '@modules/project-chat-session/controllers/chat-sessions.controller';
import { ProjectSessionsController } from '@modules/project-chat-session/controllers/project-sessions.controller';
import { ProjectChatSessionModule } from '@modules/project-chat-session/project-chat-session.module';
import { TaskReviewsController } from '@modules/task-reviews/task-reviews.controller';
import { TaskReviewsModule } from '@modules/task-reviews/task-reviews.module';
import { Module } from '@nestjs/common';
import { AiProviderKeyModule } from '@plys/libraries/ai-provider-key';
import { AiProviderKeyAdminController } from '@plys/libraries/ai-provider-key';
import { AiProviderKeyBffController } from '@plys/libraries/ai-provider-key';
import { controllerProvider, GrpcIdempotencyService } from '@plys/libraries/common-nest/grpc';

import { AiProviderKeysGrpcController } from './ai-provider-keys.grpc-controller';
import { BusinessProjectsGrpcController } from './business-projects.grpc-controller';
import { ChatSessionsGrpcController } from './chat-sessions.grpc-controller';
import { ConsultantProjectsGrpcController } from './consultant-projects.grpc-controller';
import { ExploreGrpcController } from './explore.grpc-controller';
import { HealthGrpcController } from './health.grpc-controller';
import { ProjectAiContextGrpcController } from './project-ai-context.grpc-controller';
import { TaskReviewsGrpcController } from './task-reviews.grpc-controller';

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
  controllers: [
    HealthGrpcController,
    BusinessProjectsGrpcController,
    ConsultantProjectsGrpcController,
    ExploreGrpcController,
    TaskReviewsGrpcController,
    AiProviderKeysGrpcController,
    ProjectAiContextGrpcController,
    ChatSessionsGrpcController,
  ],
  providers: [
    GrpcIdempotencyService,
    controllerProvider(BusinessProjectsController),
    controllerProvider(BusinessProjectOverviewController),
    controllerProvider(BoardController),
    controllerProvider(BacklogsController),
    controllerProvider(SettingsController),
    controllerProvider(TaskAttachmentsController),
    controllerProvider(AiSyncController),
    controllerProvider(ConsultantJoinedProjectsController),
    controllerProvider(ConsultantExploreController),
    controllerProvider(ConsultantMembershipController),
    controllerProvider(ConsultantProjectTasksController),
    controllerProvider(ExploreController),
    controllerProvider(TaskReviewsController),
    controllerProvider(AiProviderKeyAdminController),
    controllerProvider(AiProviderKeyBffController),
    controllerProvider(ProjectAiContextController),
    controllerProvider(ProjectAiContextAdminController),
    controllerProvider(AiBootstrapController),
    controllerProvider(ProjectSessionsController),
    controllerProvider(ChatSessionsController),
  ],
})
export class GrpcModule {}
