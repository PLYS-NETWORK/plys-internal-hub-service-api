import {
  IAiSessionMessageRepository,
  IAiTaskSessionRepository,
  IApplicationAnswerChoiceRepository,
  IApplicationAnswerRepository,
  IAuthTokenRepository,
  IBillingPeriodRepository,
  IBusinessProfileRepository,
  IBusinessTransactionRepository,
  IConsultantProfileRepository,
  IConsultantSkillRepository,
  IConsultantWalletRepository,
  IInvoiceLineItemRepository,
  IInvoiceRepository,
  INotificationRepository,
  IProjectApplicationRepository,
  IProjectInterviewQuestionRepository,
  IProjectMemberRepository,
  IProjectRepository,
  IProjectRequiredSkillRepository,
  IProjectStatusHistoryRepository,
  IScreeningQuestionChoiceRepository,
  IScreeningQuestionRepository,
  ISkillRepository,
  ITaskCommentAttachmentRepository,
  ITaskCommentRepository,
  ITaskDisputeRepository,
  ITaskHistoryRepository,
  ITaskRepository,
  IUserRepository,
  IUserSessionRepository,
  IUserSsoProviderRepository,
  IWalletTransactionRepository,
  IWebhookEventRepository,
} from '@modules/unit-of-work/repositories';

// One typed repository accessor per entity. Service code injects IUnitOfWork
// instead of individual repository tokens — that way `withTransaction(...)`
// produces a scoped UoW where every read/write goes through the same
// EntityManager and participates in one atomic unit.
export interface IUnitOfWork {
  // Domain 1 — Auth & Identity
  readonly users: IUserRepository;
  readonly authTokens: IAuthTokenRepository;
  readonly userSsoProviders: IUserSsoProviderRepository;
  readonly userSessions: IUserSessionRepository;

  // Domain 2 — Profiles
  readonly businessProfiles: IBusinessProfileRepository;
  readonly skills: ISkillRepository;
  readonly consultantProfiles: IConsultantProfileRepository;
  readonly consultantSkills: IConsultantSkillRepository;

  // Domain 3 — Projects
  readonly projects: IProjectRepository;
  readonly projectInterviewQuestions: IProjectInterviewQuestionRepository;
  readonly projectRequiredSkills: IProjectRequiredSkillRepository;
  readonly projectStatusHistory: IProjectStatusHistoryRepository;

  // Domain 4 — Tasks
  readonly tasks: ITaskRepository;
  readonly taskDisputes: ITaskDisputeRepository;
  readonly taskHistory: ITaskHistoryRepository;
  readonly taskComments: ITaskCommentRepository;
  readonly taskCommentAttachments: ITaskCommentAttachmentRepository;

  // Domain 5 — AI
  readonly aiTaskSessions: IAiTaskSessionRepository;
  readonly aiSessionMessages: IAiSessionMessageRepository;

  // Domain 6 — Applications
  readonly screeningQuestions: IScreeningQuestionRepository;
  readonly screeningQuestionChoices: IScreeningQuestionChoiceRepository;
  readonly projectApplications: IProjectApplicationRepository;
  readonly applicationAnswers: IApplicationAnswerRepository;
  readonly applicationAnswerChoices: IApplicationAnswerChoiceRepository;
  readonly projectMembers: IProjectMemberRepository;

  // Domain 7 — Notifications
  readonly notifications: INotificationRepository;

  // Domain 8 — Finance
  readonly billingPeriods: IBillingPeriodRepository;
  readonly invoices: IInvoiceRepository;
  readonly invoiceLineItems: IInvoiceLineItemRepository;
  readonly consultantWallets: IConsultantWalletRepository;
  readonly walletTransactions: IWalletTransactionRepository;
  readonly businessTransactions: IBusinessTransactionRepository;
  readonly webhookEvents: IWebhookEventRepository;

  withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T>;
}
