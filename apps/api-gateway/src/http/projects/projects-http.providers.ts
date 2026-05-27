import { AiBootstrapService } from '@modules/ai-bootstrap/ai-bootstrap.service';
import { BacklogsService } from '@modules/business-projects/services/backlogs.service';
import { BoardService } from '@modules/business-projects/services/board/board.service';
import { BoardHistoryService } from '@modules/business-projects/services/board/board-history.service';
import { BoardMilestonesService } from '@modules/business-projects/services/board/board-milestones.service';
import { BoardResultsService } from '@modules/business-projects/services/board/board-results.service';
import { BusinessProjectOverviewService } from '@modules/business-projects/services/overview.service';
import { ProjectPublishService } from '@modules/business-projects/services/projects/project-publish.service';
import { ProjectRepublishService } from '@modules/business-projects/services/projects/project-republish.service';
import { BusinessProjectsService } from '@modules/business-projects/services/projects/projects.service';
import { SettingsService } from '@modules/business-projects/services/settings.service';
import { TaskAttachmentsService } from '@modules/business-projects/services/task-attachments.service';
import { ConsultantExploreService } from '@modules/consultant-projects/services/consultant-explore.service';
import { ConsultantJoinedProjectsService } from '@modules/consultant-projects/services/consultant-joined-projects.service';
import { ConsultantMembershipService } from '@modules/consultant-projects/services/consultant-membership.service';
import { ConsultantProjectTasksService } from '@modules/consultant-projects/services/consultant-project-tasks.service';
import { ExploreService } from '@modules/explore/services/explore.service';
import { ProjectAiContextService } from '@modules/project-ai-context/project-ai-context.service';
import { ProjectChatSessionService } from '@modules/project-chat-session/project-chat-session.service';
import { TaskReviewQueryService } from '@modules/task-reviews/services/task-review-query.service';
import { TaskReviewVotingService } from '@modules/task-reviews/services/task-review-voting.service';
import { AiProviderKeyService } from '@plys/libraries/ai-provider-key';

import {
  AiProviderKeysClient,
  BusinessProjectsClient,
  ChatSessionsClient,
  ConsultantProjectsClient,
  ExploreClient,
  ProjectAiContextClient,
  TaskReviewsClient,
} from '@/clients/projects';
import { provideGrpcServiceProxy } from '@/http/shared/grpc-service-proxy.util';

export const PROJECTS_HTTP_PROVIDERS = [
  provideGrpcServiceProxy(BusinessProjectsService, BusinessProjectsClient, 'businessProjects'),
  provideGrpcServiceProxy(ProjectPublishService, BusinessProjectsClient, 'businessProjects'),
  provideGrpcServiceProxy(ProjectRepublishService, BusinessProjectsClient, 'businessProjects'),
  provideGrpcServiceProxy(
    BusinessProjectOverviewService,
    BusinessProjectsClient,
    'businessProjectOverview',
  ),
  provideGrpcServiceProxy(BoardService, BusinessProjectsClient, 'board'),
  provideGrpcServiceProxy(BoardHistoryService, BusinessProjectsClient, 'board'),
  provideGrpcServiceProxy(BoardResultsService, BusinessProjectsClient, 'board'),
  provideGrpcServiceProxy(BoardMilestonesService, BusinessProjectsClient, 'board'),
  provideGrpcServiceProxy(BacklogsService, BusinessProjectsClient, 'backlogs', {
    aiSyncTasks: 'aiSync.aiSyncTasks',
  }),
  provideGrpcServiceProxy(SettingsService, BusinessProjectsClient, 'settings', {
    aiSyncSettings: 'aiSync.aiSyncSettings',
    aiSyncSkills: 'aiSync.aiSyncSkills',
  }),
  provideGrpcServiceProxy(TaskAttachmentsService, BusinessProjectsClient, 'taskAttachments'),
  provideGrpcServiceProxy(
    ConsultantJoinedProjectsService,
    ConsultantProjectsClient,
    'consultantJoinedProjects',
    {
      getJoinedProjectDetail: (args) => ({
        pathParams: { projectId: String(args[0]) },
      }),
    },
  ),
  provideGrpcServiceProxy(ConsultantExploreService, ConsultantProjectsClient, 'consultantExplore'),
  provideGrpcServiceProxy(
    ConsultantMembershipService,
    ConsultantProjectsClient,
    'consultantMembership',
    {
      apply: (args) => ({ pathParams: { projectId: String(args[0]) } }),
      leave: (args) => ({ pathParams: { projectId: String(args[0]) } }),
    },
  ),
  provideGrpcServiceProxy(
    ConsultantProjectTasksService,
    ConsultantProjectsClient,
    'consultantProjectTasks',
    {
      listTasks: (args) => ({
        pathParams: { projectId: String(args[0]) },
        body: args[1],
      }),
      assignTask: (args) => ({
        pathParams: { projectId: String(args[0]), taskId: String(args[1]) },
        body: args[2],
      }),
      unassignTask: (args) => ({
        pathParams: { projectId: String(args[0]), taskId: String(args[1]) },
      }),
      submitForReview: (args) => ({
        pathParams: { projectId: String(args[0]), taskId: String(args[1]) },
      }),
    },
  ),
  provideGrpcServiceProxy(ExploreService, ExploreClient, 'explore'),
  provideGrpcServiceProxy(TaskReviewQueryService, TaskReviewsClient, 'taskReviews'),
  provideGrpcServiceProxy(TaskReviewVotingService, TaskReviewsClient, 'taskReviews', {
    submitVote: 'taskReviews.vote',
  }),
  provideGrpcServiceProxy(AiProviderKeyService, AiProviderKeysClient, 'aiProviderKeys'),
  provideGrpcServiceProxy(ProjectAiContextService, ProjectAiContextClient, 'projectAiContext'),
  provideGrpcServiceProxy(AiBootstrapService, ProjectAiContextClient, 'projectAiContext'),
  provideGrpcServiceProxy(ProjectChatSessionService, ChatSessionsClient, 'chatSessions'),
];
