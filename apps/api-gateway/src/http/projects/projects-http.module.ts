import { AiBootstrapController } from '@modules/ai-bootstrap/ai-bootstrap.controller';
import { AiSyncController } from '@modules/business-projects/controllers/ai-sync.controller';
import { BacklogsController } from '@modules/business-projects/controllers/backlogs.controller';
import { BoardController } from '@modules/business-projects/controllers/board.controller';
import { BusinessProjectOverviewController } from '@modules/business-projects/controllers/overview.controller';
import { BusinessProjectsController } from '@modules/business-projects/controllers/projects.controller';
import { SettingsController } from '@modules/business-projects/controllers/settings.controller';
import { TaskAttachmentsController } from '@modules/business-projects/controllers/task-attachments.controller';
import { ConsultantExploreController } from '@modules/consultant-projects/controllers/consultant-explore.controller';
import { ConsultantJoinedProjectsController } from '@modules/consultant-projects/controllers/consultant-joined-projects.controller';
import { ConsultantMembershipController } from '@modules/consultant-projects/controllers/consultant-membership.controller';
import { ConsultantProjectTasksController } from '@modules/consultant-projects/controllers/consultant-project-tasks.controller';
import { ExploreController } from '@modules/explore/explore.controller';
import { ProjectAiContextController } from '@modules/project-ai-context/project-ai-context.controller';
import { ProjectAiContextAdminController } from '@modules/project-ai-context/project-ai-context-admin.controller';
import { ChatSessionsController } from '@modules/project-chat-session/controllers/chat-sessions.controller';
import { ProjectSessionsController } from '@modules/project-chat-session/controllers/project-sessions.controller';
import { TaskReviewsController } from '@modules/task-reviews/task-reviews.controller';
import { Module } from '@nestjs/common';
import { AiProviderKeyAdminController } from '@plys/libraries/ai-provider-key';
import { AiProviderKeyBffController } from '@plys/libraries/ai-provider-key';

import { ProjectsClientsModule } from '@/clients/projects';

import {
  gatewayBffGuardImports,
  gatewayBffGuardProviders,
} from '../shared/gateway-http-auth.providers';
import { PROJECTS_HTTP_PROVIDERS } from './projects-http.providers';

@Module({
  imports: [ProjectsClientsModule, ...gatewayBffGuardImports],
  controllers: [
    BusinessProjectsController,
    BusinessProjectOverviewController,
    BoardController,
    BacklogsController,
    SettingsController,
    TaskAttachmentsController,
    AiSyncController,
    ConsultantJoinedProjectsController,
    ConsultantExploreController,
    ConsultantMembershipController,
    ConsultantProjectTasksController,
    ExploreController,
    TaskReviewsController,
    AiProviderKeyAdminController,
    AiProviderKeyBffController,
    ProjectAiContextController,
    ProjectAiContextAdminController,
    AiBootstrapController,
    ProjectSessionsController,
    ChatSessionsController,
  ],
  providers: [...PROJECTS_HTTP_PROVIDERS, ...gatewayBffGuardProviders],
})
export class ProjectsHttpModule {}
