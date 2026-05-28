/**
 * Gateway-local DI tokens for gRPC proxy services.
 * These prevent api-gateway from importing app service classes directly.
 */
/** DI tokens are runtime gRPC proxies; method signatures are not known at compile time. */
class GrpcServiceToken {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [methodName: string]: (...args: any[]) => any;
}

export class AdminConsultantOnboardingService extends GrpcServiceToken {}
export class AdminConsultantSkillExamService extends GrpcServiceToken {}
export class AdminDashboardSummaryService extends GrpcServiceToken {}
export class AdminGrowthTrendService extends GrpcServiceToken {}
export class AdminOnboardingQuestionsService extends GrpcServiceToken {}
export class AdminOperationalQueuesService extends GrpcServiceToken {}
export class AdminPaymentsService extends GrpcServiceToken {}
export class AdminUsersBreakdownService extends GrpcServiceToken {}
export class AiBootstrapService extends GrpcServiceToken {}
export class AiProviderKeyService extends GrpcServiceToken {}
export class BacklogsService extends GrpcServiceToken {}
export class BillingAdminService extends GrpcServiceToken {}
export class BoardHistoryService extends GrpcServiceToken {}
export class BoardMilestonesService extends GrpcServiceToken {}
export class BoardResultsService extends GrpcServiceToken {}
export class BoardService extends GrpcServiceToken {}
export class BusinessActionItemsService extends GrpcServiceToken {}
export class BusinessDashboardSummaryService extends GrpcServiceToken {}
export class BusinessOnboardingService extends GrpcServiceToken {}
export class BusinessPaymentsService extends GrpcServiceToken {}
export class BusinessProfilesAdminService extends GrpcServiceToken {}
export class BusinessProfilesService extends GrpcServiceToken {}
export class BusinessProjectHealthService extends GrpcServiceToken {}
export class BusinessProjectOverviewService extends GrpcServiceToken {}
export class BusinessProjectsService extends GrpcServiceToken {}
export class BusinessSpendTrendService extends GrpcServiceToken {}
export class BusinessTeamPerformanceService extends GrpcServiceToken {}
export class ConsultantActionItemsService extends GrpcServiceToken {}
export class ConsultantDashboardSummaryService extends GrpcServiceToken {}
export class ConsultantEarningsTrendService extends GrpcServiceToken {}
export class ConsultantExploreService extends GrpcServiceToken {}
export class ConsultantJoinedProjectsService extends GrpcServiceToken {}
export class ConsultantMembershipService extends GrpcServiceToken {}
export class ConsultantOnboardingService extends GrpcServiceToken {}
export class ConsultantPaymentsService extends GrpcServiceToken {}
export class ConsultantProfilesAdminService extends GrpcServiceToken {}
export class ConsultantProfilesService extends GrpcServiceToken {}
export class ConsultantProjectProgressService extends GrpcServiceToken {}
export class ConsultantProjectTasksService extends GrpcServiceToken {}
export class ConsultantSkillExamService extends GrpcServiceToken {}
export class ConsultantSkillPerformanceService extends GrpcServiceToken {}
export class ExploreService extends GrpcServiceToken {}
export class HealthService extends GrpcServiceToken {}
export class NotificationsService extends GrpcServiceToken {}
export class OnboardingInterviewService extends GrpcServiceToken {}
export class PaymentsService extends GrpcServiceToken {}
export class ProjectAiContextService extends GrpcServiceToken {}
export class ProjectChatSessionService extends GrpcServiceToken {}
export class ProjectPublishService extends GrpcServiceToken {}
export class ProjectRepublishService extends GrpcServiceToken {}
export class SettingsService extends GrpcServiceToken {}
export class SkillsService extends GrpcServiceToken {}
export class TaskAttachmentsService extends GrpcServiceToken {}
export class TaskReviewQueryService extends GrpcServiceToken {}
export class TaskReviewVotingService extends GrpcServiceToken {}
