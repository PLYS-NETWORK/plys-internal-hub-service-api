import {
  IAdminAllowedEmailRepository,
  IAiProviderApiKeyRepository,
  IAiSessionMessageRepository,
  IAiTaskSessionRepository,
  IAuthTokenRepository,
  IBillingPeriodRepository,
  IBusinessProfileRepository,
  IBusinessTransactionRepository,
  IChatMessageRepository,
  IConsultantOnboardingAnswerRepository,
  IConsultantOnboardingQuestionRepository,
  IConsultantOnboardingRepository,
  IConsultantProfileRepository,
  IConsultantSkillExamAnswerRepository,
  IConsultantSkillExamQuestionRepository,
  IConsultantSkillExamRepository,
  IConsultantSkillRepository,
  IConsultantSkillScoreRepository,
  IConsultantTransactionRepository,
  IFileRepository,
  IIdempotencyKeyRepository,
  IInterviewQuestionRepository,
  IInvoiceLineItemRepository,
  IInvoiceRepository,
  INotificationRepository,
  IProjectActivityRepository,
  IProjectAiContextRepository,
  IProjectChatSessionRepository,
  IProjectMemberRepository,
  IProjectRepository,
  IProjectRequiredSkillRepository,
  IProjectStatusHistoryRepository,
  ISkillRepository,
  ITaskAttachmentRepository,
  ITaskCodeService,
  ITaskDisputeRepository,
  ITaskHistoryRepository,
  ITaskRepository,
  ITaskResultAttachmentRepository,
  ITaskResultRepository,
  IUserRepository,
  IUserSessionRepository,
  IUserSsoProviderRepository,
  IWebhookEventRepository,
  TransactionNumberService,
} from '@modules/unit-of-work/repositories';

export interface IUnitOfWork {
  // Domain 0 — Admin
  readonly adminAllowedEmails: IAdminAllowedEmailRepository;

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
  readonly projectRequiredSkills: IProjectRequiredSkillRepository;
  readonly projectActivity: IProjectActivityRepository;
  readonly projectStatusHistory: IProjectStatusHistoryRepository;
  readonly taskCodes: ITaskCodeService;
  readonly projectMembers: IProjectMemberRepository;
  readonly projectChatSessions: IProjectChatSessionRepository;
  readonly chatMessages: IChatMessageRepository;
  readonly projectAiContexts: IProjectAiContextRepository;

  // Domain 4 — Tasks
  readonly tasks: ITaskRepository;
  readonly taskAttachments: ITaskAttachmentRepository;
  readonly taskDisputes: ITaskDisputeRepository;
  readonly taskHistory: ITaskHistoryRepository;
  readonly taskResults: ITaskResultRepository;
  readonly taskResultAttachments: ITaskResultAttachmentRepository;

  // Domain 5 — AI
  readonly aiTaskSessions: IAiTaskSessionRepository;
  readonly aiSessionMessages: IAiSessionMessageRepository;

  // Domain 6 — Finance
  readonly billingPeriods: IBillingPeriodRepository;
  readonly invoices: IInvoiceRepository;
  readonly invoiceLineItems: IInvoiceLineItemRepository;
  readonly consultantTransactions: IConsultantTransactionRepository;
  readonly businessTransactions: IBusinessTransactionRepository;
  readonly transactionNumbers: TransactionNumberService;
  readonly webhookEvents: IWebhookEventRepository;

  // Domain 7 — Files
  readonly files: IFileRepository;

  // Domain 8 — Notifications
  readonly notifications: INotificationRepository;

  // Domain 9 — Infra (cross-cutting)
  readonly idempotencyKeys: IIdempotencyKeyRepository;
  readonly aiProviderApiKeys: IAiProviderApiKeyRepository;

  // Domain 10 — Onboarding (consultant signup gate)
  readonly consultantOnboardings: IConsultantOnboardingRepository;
  readonly consultantOnboardingQuestions: IConsultantOnboardingQuestionRepository;
  readonly consultantOnboardingAnswers: IConsultantOnboardingAnswerRepository;
  readonly interviewQuestions: IInterviewQuestionRepository;

  // Domain 11 — Skill exams (per-skill, multiple per consultant)
  readonly consultantSkillExams: IConsultantSkillExamRepository;
  readonly consultantSkillExamQuestions: IConsultantSkillExamQuestionRepository;
  readonly consultantSkillExamAnswers: IConsultantSkillExamAnswerRepository;
  readonly consultantSkillScores: IConsultantSkillScoreRepository;

  withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T>;
}
