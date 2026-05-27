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
import {
  AiProviderKeyAdminController,
  AiProviderKeyBffController,
} from '@plys/libraries/ai-provider-key';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

export const GRPC_HTTP_PROVIDERS = [
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
];
