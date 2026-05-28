import {
  BusinessOnboardingClient,
  BusinessProfilesClient,
  BusinessProjectsClient,
  BusinessStatisticsClient,
} from '@/clients/v1/business';
import { provideGrpcServiceProxy } from '@/http/v1/shared/grpc-service-proxy.util';
import {
  BacklogsService,
  BoardHistoryService,
  BoardMilestonesService,
  BoardResultsService,
  BoardService,
  BusinessActionItemsService,
  BusinessDashboardSummaryService,
  BusinessOnboardingService,
  BusinessProfilesAdminService,
  BusinessProfilesService,
  BusinessProjectHealthService,
  BusinessProjectOverviewService,
  BusinessProjectsService,
  BusinessSpendTrendService,
  BusinessTeamPerformanceService,
  ProjectPublishService,
  ProjectRepublishService,
  SettingsService,
  TaskAttachmentsService,
} from '@/http/v1/shared/grpc-service-tokens';

export const BUSINESS_HTTP_PROVIDERS = [
  provideGrpcServiceProxy(BusinessProfilesService, BusinessProfilesClient, 'businessProfiles'),
  provideGrpcServiceProxy(
    BusinessProfilesAdminService,
    BusinessProfilesClient,
    'businessProfilesAdmin',
  ),
  provideGrpcServiceProxy(
    BusinessOnboardingService,
    BusinessOnboardingClient,
    'businessOnboarding',
  ),
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
    BusinessDashboardSummaryService,
    BusinessStatisticsClient,
    'businessDashboard',
    {
      get: 'businessDashboard.getSummary',
    },
  ),
  provideGrpcServiceProxy(
    BusinessActionItemsService,
    BusinessStatisticsClient,
    'businessDashboard',
    {
      get: 'businessDashboard.getActionItems',
    },
  ),
  provideGrpcServiceProxy(
    BusinessSpendTrendService,
    BusinessStatisticsClient,
    'businessDashboard',
    {
      get: 'businessDashboard.getSpendTrend',
    },
  ),
  provideGrpcServiceProxy(
    BusinessProjectHealthService,
    BusinessStatisticsClient,
    'businessDashboard',
    {
      get: 'businessDashboard.getProjectHealth',
    },
  ),
  provideGrpcServiceProxy(
    BusinessTeamPerformanceService,
    BusinessStatisticsClient,
    'businessDashboard',
    {
      get: 'businessDashboard.getTeamPerformance',
    },
  ),
];
