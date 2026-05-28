import {
  ConsultantOnboardingClient,
  ConsultantProfilesClient,
  ConsultantProjectsClient,
  ConsultantStatisticsClient,
  ExploreClient,
  SkillExamsClient,
} from '@/clients/v1/consultant';
import { provideGrpcServiceProxy } from '@/http/v1/shared/grpc-service-proxy.util';
import {
  ConsultantActionItemsService,
  ConsultantDashboardSummaryService,
  ConsultantEarningsTrendService,
  ConsultantExploreService,
  ConsultantJoinedProjectsService,
  ConsultantMembershipService,
  ConsultantOnboardingService,
  ConsultantProfilesAdminService,
  ConsultantProfilesService,
  ConsultantProjectProgressService,
  ConsultantProjectTasksService,
  ConsultantSkillExamService,
  ConsultantSkillPerformanceService,
  ExploreService,
  OnboardingInterviewService,
} from '@/http/v1/shared/grpc-service-tokens';

export const CONSULTANT_HTTP_PROVIDERS = [
  provideGrpcServiceProxy(
    ConsultantProfilesService,
    ConsultantProfilesClient,
    'consultantProfiles',
  ),
  provideGrpcServiceProxy(
    ConsultantProfilesAdminService,
    ConsultantProfilesClient,
    'consultantProfilesAdmin',
  ),
  provideGrpcServiceProxy(
    ConsultantOnboardingService,
    ConsultantOnboardingClient,
    'consultantOnboarding',
  ),
  provideGrpcServiceProxy(
    OnboardingInterviewService,
    ConsultantOnboardingClient,
    'consultantOnboarding',
    {
      getQuestions: 'consultantOnboarding.getQuestions',
      submitAnswers: 'consultantOnboarding.submitInterview',
    },
  ),
  provideGrpcServiceProxy(ConsultantSkillExamService, SkillExamsClient, 'consultantSkillExam'),
  provideGrpcServiceProxy(
    ConsultantJoinedProjectsService,
    ConsultantProjectsClient,
    'consultantJoinedProjects',
    {
      getJoinedProjectDetail: (args: unknown[]) => ({
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
      apply: (args: unknown[]) => ({ pathParams: { projectId: String(args[0]) } }),
      leave: (args: unknown[]) => ({ pathParams: { projectId: String(args[0]) } }),
    },
  ),
  provideGrpcServiceProxy(
    ConsultantProjectTasksService,
    ConsultantProjectsClient,
    'consultantProjectTasks',
    {
      listTasks: (args: unknown[]) => ({
        pathParams: { projectId: String(args[0]) },
        body: args[1],
      }),
      assignTask: (args: unknown[]) => ({
        pathParams: { projectId: String(args[0]), taskId: String(args[1]) },
        body: args[2],
      }),
      unassignTask: (args: unknown[]) => ({
        pathParams: { projectId: String(args[0]), taskId: String(args[1]) },
      }),
      submitForReview: (args: unknown[]) => ({
        pathParams: { projectId: String(args[0]), taskId: String(args[1]) },
      }),
    },
  ),
  provideGrpcServiceProxy(ExploreService, ExploreClient, 'explore'),
  provideGrpcServiceProxy(
    ConsultantDashboardSummaryService,
    ConsultantStatisticsClient,
    'consultantDashboard',
    { get: 'consultantDashboard.getSummary' },
  ),
  provideGrpcServiceProxy(
    ConsultantActionItemsService,
    ConsultantStatisticsClient,
    'consultantDashboard',
    {
      get: 'consultantDashboard.getActionItems',
    },
  ),
  provideGrpcServiceProxy(
    ConsultantEarningsTrendService,
    ConsultantStatisticsClient,
    'consultantDashboard',
    {
      get: 'consultantDashboard.getEarningsTrend',
    },
  ),
  provideGrpcServiceProxy(
    ConsultantProjectProgressService,
    ConsultantStatisticsClient,
    'consultantDashboard',
    { get: 'consultantDashboard.getProjectProgress' },
  ),
  provideGrpcServiceProxy(
    ConsultantSkillPerformanceService,
    ConsultantStatisticsClient,
    'consultantDashboard',
    { get: 'consultantDashboard.getSkillPerformance' },
  ),
];
