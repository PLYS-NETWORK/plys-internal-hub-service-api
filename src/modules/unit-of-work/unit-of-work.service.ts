import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { IUnitOfWork } from './interfaces/unit-of-work.interface';
import {
  AdminAllowedEmailRepository,
  AiProviderApiKeyRepository,
  AiSessionMessageRepository,
  AiTaskSessionRepository,
  AuthTokenRepository,
  BillingPeriodRepository,
  BusinessProfileRepository,
  BusinessTransactionRepository,
  ChatMessageRepository,
  ConsultantApplicationAnswerRepository,
  ConsultantApplicationQuestionRepository,
  ConsultantApplicationRepository,
  ConsultantProfileRepository,
  ConsultantSkillRepository,
  ConsultantSkillScoreRepository,
  ConsultantTransactionRepository,
  ContactInquiryRepository,
  FileRepository,
  IAdminAllowedEmailRepository,
  IAiProviderApiKeyRepository,
  IAiSessionMessageRepository,
  IAiTaskSessionRepository,
  IAuthTokenRepository,
  IBillingPeriodRepository,
  IBusinessProfileRepository,
  IBusinessTransactionRepository,
  IChatMessageRepository,
  IConsultantApplicationAnswerRepository,
  IConsultantApplicationQuestionRepository,
  IConsultantApplicationRepository,
  IConsultantProfileRepository,
  IConsultantSkillRepository,
  IConsultantSkillScoreRepository,
  IConsultantTransactionRepository,
  IContactInquiryRepository,
  IdempotencyKeyRepository,
  IFileRepository,
  IIdempotencyKeyRepository,
  IInterviewQuestionRepository,
  IInvoiceLineItemRepository,
  IInvoiceRepository,
  INotificationRepository,
  InterviewQuestionRepository,
  InvoiceLineItemRepository,
  InvoiceRepository,
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
  NotificationRepository,
  ProjectActivityRepository,
  ProjectAiContextRepository,
  ProjectChatSessionRepository,
  ProjectMemberRepository,
  ProjectRepository,
  ProjectRequiredSkillRepository,
  ProjectStatusHistoryRepository,
  SkillRepository,
  TaskAttachmentRepository,
  TaskCodeService,
  TaskDisputeRepository,
  TaskHistoryRepository,
  TaskRepository,
  TaskResultAttachmentRepository,
  TaskResultRepository,
  TransactionNumberService,
  UserRepository,
  UserSessionRepository,
  UserSsoProviderRepository,
  WebhookEventRepository,
} from './repositories';

// Holds pre-built transactional repository clones for one QueryRunner lifetime.
// All reads/writes inside `withTransaction` callback share the same manager.
class TransactionalUnitOfWork implements IUnitOfWork {
  constructor(
    public readonly adminAllowedEmails: IAdminAllowedEmailRepository,
    public readonly users: IUserRepository,
    public readonly authTokens: IAuthTokenRepository,
    public readonly userSsoProviders: IUserSsoProviderRepository,
    public readonly userSessions: IUserSessionRepository,
    public readonly businessProfiles: IBusinessProfileRepository,
    public readonly skills: ISkillRepository,
    public readonly consultantProfiles: IConsultantProfileRepository,
    public readonly consultantSkills: IConsultantSkillRepository,
    public readonly projects: IProjectRepository,
    public readonly projectRequiredSkills: IProjectRequiredSkillRepository,
    public readonly projectActivity: IProjectActivityRepository,
    public readonly projectStatusHistory: IProjectStatusHistoryRepository,
    public readonly taskCodes: ITaskCodeService,
    public readonly tasks: ITaskRepository,
    public readonly taskAttachments: ITaskAttachmentRepository,
    public readonly taskDisputes: ITaskDisputeRepository,
    public readonly taskHistory: ITaskHistoryRepository,
    public readonly taskResults: ITaskResultRepository,
    public readonly taskResultAttachments: ITaskResultAttachmentRepository,
    public readonly aiTaskSessions: IAiTaskSessionRepository,
    public readonly aiSessionMessages: IAiSessionMessageRepository,
    public readonly projectMembers: IProjectMemberRepository,
    public readonly projectChatSessions: IProjectChatSessionRepository,
    public readonly chatMessages: IChatMessageRepository,
    public readonly projectAiContexts: IProjectAiContextRepository,
    public readonly billingPeriods: IBillingPeriodRepository,
    public readonly invoices: IInvoiceRepository,
    public readonly invoiceLineItems: IInvoiceLineItemRepository,
    public readonly consultantTransactions: IConsultantTransactionRepository,
    public readonly businessTransactions: IBusinessTransactionRepository,
    public readonly transactionNumbers: TransactionNumberService,
    public readonly webhookEvents: IWebhookEventRepository,
    public readonly files: IFileRepository,
    public readonly notifications: INotificationRepository,
    public readonly idempotencyKeys: IIdempotencyKeyRepository,
    public readonly aiProviderApiKeys: IAiProviderApiKeyRepository,
    // Domain 10 — Applications
    public readonly consultantApplications: IConsultantApplicationRepository,
    public readonly interviewQuestions: IInterviewQuestionRepository,
    public readonly applicationQuestions: IConsultantApplicationQuestionRepository,
    public readonly applicationAnswers: IConsultantApplicationAnswerRepository,
    public readonly consultantSkillScores: IConsultantSkillScoreRepository,
    // Domain 11 — Contact
    public readonly contactInquiries: IContactInquiryRepository,
  ) {}

  // Already inside a transaction — pass-through to avoid nested QueryRunners.
  public async withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    return work(this);
  }
}

@Injectable()
export class UnitOfWorkService implements IUnitOfWork {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    // Domain 0 — Admin
    public readonly adminAllowedEmails: AdminAllowedEmailRepository,
    // Domain 1 — Auth & Identity
    public readonly users: UserRepository,
    public readonly authTokens: AuthTokenRepository,
    public readonly userSsoProviders: UserSsoProviderRepository,
    public readonly userSessions: UserSessionRepository,
    // Domain 2 — Profiles
    public readonly businessProfiles: BusinessProfileRepository,
    public readonly skills: SkillRepository,
    public readonly consultantProfiles: ConsultantProfileRepository,
    public readonly consultantSkills: ConsultantSkillRepository,
    // Domain 3 — Projects
    public readonly projects: ProjectRepository,
    public readonly projectRequiredSkills: ProjectRequiredSkillRepository,
    public readonly projectActivity: ProjectActivityRepository,
    public readonly projectStatusHistory: ProjectStatusHistoryRepository,
    public readonly taskCodes: TaskCodeService,
    public readonly projectMembers: ProjectMemberRepository,
    public readonly projectChatSessions: ProjectChatSessionRepository,
    public readonly chatMessages: ChatMessageRepository,
    public readonly projectAiContexts: ProjectAiContextRepository,
    // Domain 4 — Tasks
    public readonly tasks: TaskRepository,
    public readonly taskAttachments: TaskAttachmentRepository,
    public readonly taskDisputes: TaskDisputeRepository,
    public readonly taskHistory: TaskHistoryRepository,
    public readonly taskResults: TaskResultRepository,
    public readonly taskResultAttachments: TaskResultAttachmentRepository,
    // Domain 5 — AI
    public readonly aiTaskSessions: AiTaskSessionRepository,
    public readonly aiSessionMessages: AiSessionMessageRepository,
    // Domain 6 — Finance
    public readonly billingPeriods: BillingPeriodRepository,
    public readonly invoices: InvoiceRepository,
    public readonly invoiceLineItems: InvoiceLineItemRepository,
    public readonly consultantTransactions: ConsultantTransactionRepository,
    public readonly businessTransactions: BusinessTransactionRepository,
    public readonly transactionNumbers: TransactionNumberService,
    public readonly webhookEvents: WebhookEventRepository,
    // Domain 7 — Files
    public readonly files: FileRepository,
    // Domain 8 — Notifications
    public readonly notifications: NotificationRepository,
    // Domain 9 — Infra (cross-cutting)
    public readonly idempotencyKeys: IdempotencyKeyRepository,
    public readonly aiProviderApiKeys: AiProviderApiKeyRepository,
    // Domain 10 — Applications
    public readonly consultantApplications: ConsultantApplicationRepository,
    public readonly interviewQuestions: InterviewQuestionRepository,
    public readonly applicationQuestions: ConsultantApplicationQuestionRepository,
    public readonly applicationAnswers: ConsultantApplicationAnswerRepository,
    public readonly consultantSkillScores: ConsultantSkillScoreRepository,
    // Domain 11 — Contact
    public readonly contactInquiries: ContactInquiryRepository,
  ) {}

  public async withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { manager } = queryRunner;

      const txUow = new TransactionalUnitOfWork(
        this.adminAllowedEmails.withManager(manager),
        this.users.withManager(manager),
        this.authTokens.withManager(manager),
        this.userSsoProviders.withManager(manager),
        this.userSessions.withManager(manager),
        this.businessProfiles.withManager(manager),
        this.skills.withManager(manager),
        this.consultantProfiles.withManager(manager),
        this.consultantSkills.withManager(manager),
        this.projects.withManager(manager),
        this.projectRequiredSkills.withManager(manager),
        this.projectActivity.withManager(manager),
        this.projectStatusHistory.withManager(manager),
        this.taskCodes.withManager(manager),
        this.tasks.withManager(manager),
        this.taskAttachments.withManager(manager),
        this.taskDisputes.withManager(manager),
        this.taskHistory.withManager(manager),
        this.taskResults.withManager(manager),
        this.taskResultAttachments.withManager(manager),
        this.aiTaskSessions.withManager(manager),
        this.aiSessionMessages.withManager(manager),
        this.projectMembers.withManager(manager),
        this.projectChatSessions.withManager(manager),
        this.chatMessages.withManager(manager),
        this.projectAiContexts.withManager(manager),
        this.billingPeriods.withManager(manager),
        this.invoices.withManager(manager),
        this.invoiceLineItems.withManager(manager),
        this.consultantTransactions.withManager(manager),
        this.businessTransactions.withManager(manager),
        this.transactionNumbers.withManager(manager),
        this.webhookEvents.withManager(manager),
        this.files.withManager(manager),
        this.notifications.withManager(manager),
        this.idempotencyKeys.withManager(manager),
        this.aiProviderApiKeys.withManager(manager),
        this.consultantApplications.withManager(manager),
        this.interviewQuestions.withManager(manager),
        this.applicationQuestions.withManager(manager),
        this.applicationAnswers.withManager(manager),
        this.consultantSkillScores.withManager(manager),
        this.contactInquiries.withManager(manager),
      );

      const result = await work(txUow);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
