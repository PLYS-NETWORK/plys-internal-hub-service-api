import {
  AdminOnboardingClient,
  AdminProjectAiContextClient,
  AdminSkillExamsClient,
  AdminStatisticsClient,
} from '@/clients/v1/internal-admin';
import { provideGrpcServiceProxy } from '@/http/v1/shared/grpc-service-proxy.util';
import {
  AdminConsultantOnboardingService,
  AdminConsultantSkillExamService,
  AdminDashboardSummaryService,
  AdminGrowthTrendService,
  AdminOnboardingQuestionsService,
  AdminOperationalQueuesService,
  AdminUsersBreakdownService,
  ProjectAiContextService,
} from '@/http/v1/shared/grpc-service-tokens';

export const INTERNAL_ADMIN_HTTP_PROVIDERS = [
  provideGrpcServiceProxy(
    AdminConsultantOnboardingService,
    AdminOnboardingClient,
    'adminConsultantOnboarding',
  ),
  provideGrpcServiceProxy(
    AdminOnboardingQuestionsService,
    AdminOnboardingClient,
    'adminOnboardingQuestions',
  ),
  provideGrpcServiceProxy(
    AdminConsultantSkillExamService,
    AdminSkillExamsClient,
    'adminConsultantSkillExam',
  ),
  provideGrpcServiceProxy(ProjectAiContextService, AdminProjectAiContextClient, 'projectAiContext'),
  provideGrpcServiceProxy(AdminDashboardSummaryService, AdminStatisticsClient, 'adminStatistics', {
    get: 'adminStatistics.getSummary',
  }),
  provideGrpcServiceProxy(AdminUsersBreakdownService, AdminStatisticsClient, 'adminStatistics', {
    get: 'adminStatistics.getUsersBreakdown',
  }),
  provideGrpcServiceProxy(AdminGrowthTrendService, AdminStatisticsClient, 'adminStatistics', {
    get: 'adminStatistics.getGrowthTrend',
  }),
  provideGrpcServiceProxy(AdminOperationalQueuesService, AdminStatisticsClient, 'adminStatistics', {
    get: 'adminStatistics.getOperationalQueues',
  }),
];
