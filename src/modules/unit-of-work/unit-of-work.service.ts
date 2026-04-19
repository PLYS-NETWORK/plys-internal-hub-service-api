import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { IUnitOfWork } from './interfaces/unit-of-work.interface';
import {
  AiSessionMessageRepository,
  AiTaskSessionRepository,
  ApplicationAnswerChoiceRepository,
  ApplicationAnswerRepository,
  AuthTokenRepository,
  BillingPeriodRepository,
  BusinessProfileRepository,
  BusinessTransactionRepository,
  ConsultantProfileRepository,
  ConsultantSkillRepository,
  ConsultantWalletRepository,
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
  InvoiceLineItemRepository,
  InvoiceRepository,
  IProjectApplicationRepository,
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
  NotificationRepository,
  ProjectApplicationRepository,
  ProjectMemberRepository,
  ProjectRepository,
  ProjectRequiredSkillRepository,
  ProjectStatusHistoryRepository,
  ScreeningQuestionChoiceRepository,
  ScreeningQuestionRepository,
  SkillRepository,
  TaskCommentAttachmentRepository,
  TaskCommentRepository,
  TaskDisputeRepository,
  TaskHistoryRepository,
  TaskRepository,
  UserRepository,
  UserSessionRepository,
  UserSsoProviderRepository,
  WalletTransactionRepository,
  WebhookEventRepository,
} from './repositories';

// Holds pre-built transactional repository clones for one QueryRunner lifetime.
// All reads/writes inside `withTransaction` callback share the same manager.
class TransactionalUnitOfWork implements IUnitOfWork {
  constructor(
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
    public readonly projectStatusHistory: IProjectStatusHistoryRepository,
    public readonly tasks: ITaskRepository,
    public readonly taskDisputes: ITaskDisputeRepository,
    public readonly taskHistory: ITaskHistoryRepository,
    public readonly taskComments: ITaskCommentRepository,
    public readonly taskCommentAttachments: ITaskCommentAttachmentRepository,
    public readonly aiTaskSessions: IAiTaskSessionRepository,
    public readonly aiSessionMessages: IAiSessionMessageRepository,
    public readonly screeningQuestions: IScreeningQuestionRepository,
    public readonly screeningQuestionChoices: IScreeningQuestionChoiceRepository,
    public readonly projectApplications: IProjectApplicationRepository,
    public readonly applicationAnswers: IApplicationAnswerRepository,
    public readonly applicationAnswerChoices: IApplicationAnswerChoiceRepository,
    public readonly projectMembers: IProjectMemberRepository,
    public readonly notifications: INotificationRepository,
    public readonly billingPeriods: IBillingPeriodRepository,
    public readonly invoices: IInvoiceRepository,
    public readonly invoiceLineItems: IInvoiceLineItemRepository,
    public readonly consultantWallets: IConsultantWalletRepository,
    public readonly walletTransactions: IWalletTransactionRepository,
    public readonly businessTransactions: IBusinessTransactionRepository,
    public readonly webhookEvents: IWebhookEventRepository,
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
    public readonly projectStatusHistory: ProjectStatusHistoryRepository,
    // Domain 4 — Tasks
    public readonly tasks: TaskRepository,
    public readonly taskDisputes: TaskDisputeRepository,
    public readonly taskHistory: TaskHistoryRepository,
    public readonly taskComments: TaskCommentRepository,
    public readonly taskCommentAttachments: TaskCommentAttachmentRepository,
    // Domain 5 — AI
    public readonly aiTaskSessions: AiTaskSessionRepository,
    public readonly aiSessionMessages: AiSessionMessageRepository,
    // Domain 6 — Applications
    public readonly screeningQuestions: ScreeningQuestionRepository,
    public readonly screeningQuestionChoices: ScreeningQuestionChoiceRepository,
    public readonly projectApplications: ProjectApplicationRepository,
    public readonly applicationAnswers: ApplicationAnswerRepository,
    public readonly applicationAnswerChoices: ApplicationAnswerChoiceRepository,
    public readonly projectMembers: ProjectMemberRepository,
    // Domain 7 — Notifications
    public readonly notifications: NotificationRepository,
    // Domain 8 — Finance
    public readonly billingPeriods: BillingPeriodRepository,
    public readonly invoices: InvoiceRepository,
    public readonly invoiceLineItems: InvoiceLineItemRepository,
    public readonly consultantWallets: ConsultantWalletRepository,
    public readonly walletTransactions: WalletTransactionRepository,
    public readonly businessTransactions: BusinessTransactionRepository,
    public readonly webhookEvents: WebhookEventRepository,
  ) {}

  public async withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { manager } = queryRunner;

      const txUow = new TransactionalUnitOfWork(
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
        this.projectStatusHistory.withManager(manager),
        this.tasks.withManager(manager),
        this.taskDisputes.withManager(manager),
        this.taskHistory.withManager(manager),
        this.taskComments.withManager(manager),
        this.taskCommentAttachments.withManager(manager),
        this.aiTaskSessions.withManager(manager),
        this.aiSessionMessages.withManager(manager),
        this.screeningQuestions.withManager(manager),
        this.screeningQuestionChoices.withManager(manager),
        this.projectApplications.withManager(manager),
        this.applicationAnswers.withManager(manager),
        this.applicationAnswerChoices.withManager(manager),
        this.projectMembers.withManager(manager),
        this.notifications.withManager(manager),
        this.billingPeriods.withManager(manager),
        this.invoices.withManager(manager),
        this.invoiceLineItems.withManager(manager),
        this.consultantWallets.withManager(manager),
        this.walletTransactions.withManager(manager),
        this.businessTransactions.withManager(manager),
        this.webhookEvents.withManager(manager),
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
