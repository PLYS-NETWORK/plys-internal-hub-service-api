import { HealthService } from '@modules/health/health.service';
import { NotificationsService } from '@modules/notifications/services/notifications.service';
import { SkillsService } from '@modules/skills/skills.service';
import { AdminDashboardSummaryService } from '@modules/statistics/admin/services/admin-dashboard-summary.service';
import { AdminGrowthTrendService } from '@modules/statistics/admin/services/admin-growth-trend.service';
import { AdminOperationalQueuesService } from '@modules/statistics/admin/services/admin-operational-queues.service';
import { AdminUsersBreakdownService } from '@modules/statistics/admin/services/admin-users-breakdown.service';
import { BusinessActionItemsService } from '@modules/statistics/business/dashboard/services/business-action-items.service';
import { BusinessDashboardSummaryService } from '@modules/statistics/business/dashboard/services/business-dashboard-summary.service';
import { BusinessProjectHealthService } from '@modules/statistics/business/dashboard/services/business-project-health.service';
import { BusinessSpendTrendService } from '@modules/statistics/business/dashboard/services/business-spend-trend.service';
import { BusinessTeamPerformanceService } from '@modules/statistics/business/dashboard/services/business-team-performance.service';
import { ConsultantActionItemsService } from '@modules/statistics/consultant/dashboard/services/consultant-action-items.service';
import { ConsultantDashboardSummaryService } from '@modules/statistics/consultant/dashboard/services/consultant-dashboard-summary.service';
import { ConsultantEarningsTrendService } from '@modules/statistics/consultant/dashboard/services/consultant-earnings-trend.service';
import { ConsultantProjectProgressService } from '@modules/statistics/consultant/dashboard/services/consultant-project-progress.service';
import { ConsultantSkillPerformanceService } from '@modules/statistics/consultant/dashboard/services/consultant-skill-performance.service';

import {
  NotificationsClient,
  PlatformHealthClient,
  SkillsClient,
  StatisticsClient,
} from '@/clients/platform';
import { provideGrpcServiceProxy } from '@/http/shared/grpc-service-proxy.util';

export const PLATFORM_HTTP_PROVIDERS = [
  provideGrpcServiceProxy(SkillsService, SkillsClient, 'skills'),
  provideGrpcServiceProxy(NotificationsService, NotificationsClient, 'notifications'),
  provideGrpcServiceProxy(HealthService, PlatformHealthClient, 'health'),
  provideGrpcServiceProxy(AdminDashboardSummaryService, StatisticsClient, 'adminStatistics', {
    get: 'adminStatistics.getSummary',
  }),
  provideGrpcServiceProxy(AdminUsersBreakdownService, StatisticsClient, 'adminStatistics', {
    get: 'adminStatistics.getUsersBreakdown',
  }),
  provideGrpcServiceProxy(AdminGrowthTrendService, StatisticsClient, 'adminStatistics', {
    get: 'adminStatistics.getGrowthTrend',
  }),
  provideGrpcServiceProxy(AdminOperationalQueuesService, StatisticsClient, 'adminStatistics', {
    get: 'adminStatistics.getOperationalQueues',
  }),
  provideGrpcServiceProxy(BusinessDashboardSummaryService, StatisticsClient, 'businessDashboard', {
    get: 'businessDashboard.getSummary',
  }),
  provideGrpcServiceProxy(BusinessActionItemsService, StatisticsClient, 'businessDashboard', {
    get: 'businessDashboard.getActionItems',
  }),
  provideGrpcServiceProxy(BusinessSpendTrendService, StatisticsClient, 'businessDashboard', {
    get: 'businessDashboard.getSpendTrend',
  }),
  provideGrpcServiceProxy(BusinessProjectHealthService, StatisticsClient, 'businessDashboard', {
    get: 'businessDashboard.getProjectHealth',
  }),
  provideGrpcServiceProxy(BusinessTeamPerformanceService, StatisticsClient, 'businessDashboard', {
    get: 'businessDashboard.getTeamPerformance',
  }),
  provideGrpcServiceProxy(
    ConsultantDashboardSummaryService,
    StatisticsClient,
    'consultantDashboard',
    {
      get: 'consultantDashboard.getSummary',
    },
  ),
  provideGrpcServiceProxy(ConsultantActionItemsService, StatisticsClient, 'consultantDashboard', {
    get: 'consultantDashboard.getActionItems',
  }),
  provideGrpcServiceProxy(ConsultantEarningsTrendService, StatisticsClient, 'consultantDashboard', {
    get: 'consultantDashboard.getEarningsTrend',
  }),
  provideGrpcServiceProxy(
    ConsultantProjectProgressService,
    StatisticsClient,
    'consultantDashboard',
    {
      get: 'consultantDashboard.getProjectProgress',
    },
  ),
  provideGrpcServiceProxy(
    ConsultantSkillPerformanceService,
    StatisticsClient,
    'consultantDashboard',
    {
      get: 'consultantDashboard.getSkillPerformance',
    },
  ),
];
