import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { IUnitOfWork } from './interfaces/unit-of-work.interface';
import {
  AiSessionMessageRepository,
  AiTaskSessionRepository,
  AuthTokenRepository,
  BillingPeriodRepository,
  BusinessProfileRepository,
  BusinessTransactionRepository,
  ConsultantProfileRepository,
  ConsultantSkillRepository,
  ConsultantTransactionRepository,
  FileRepository,
  IAiSessionMessageRepository,
  IAiTaskSessionRepository,
  IAuthTokenRepository,
  IBillingPeriodRepository,
  IBusinessProfileRepository,
  IBusinessTransactionRepository,
  IConsultantProfileRepository,
  IConsultantSkillRepository,
  IConsultantTransactionRepository,
  IFileRepository,
  IInterviewAnswerRepository,
  IInvoiceLineItemRepository,
  IInvoiceRepository,
  INotificationRepository,
  InterviewAnswerRepository,
  InvoiceLineItemRepository,
  InvoiceRepository,
  IProjectApplicationRepository,
  IProjectInterviewQuestionRepository,
  IProjectMemberRepository,
  IProjectRepository,
  IProjectRequiredSkillRepository,
  IProjectStatusHistoryRepository,
  ISkillRepository,
  ITaskCommentAttachmentRepository,
  ITaskCommentRepository,
  ITaskDisputeRepository,
  ITaskHistoryRepository,
  ITaskRepository,
  IUserRepository,
  IUserSessionRepository,
  IUserSsoProviderRepository,
  IWebhookEventRepository,
  NotificationRepository,
  ProjectApplicationRepository,
  ProjectInterviewQuestionRepository,
  ProjectMemberRepository,
  ProjectRepository,
  ProjectRequiredSkillRepository,
  ProjectStatusHistoryRepository,
  SkillRepository,
  TaskCommentAttachmentRepository,
  TaskCommentRepository,
  TaskDisputeRepository,
  TaskHistoryRepository,
  TaskRepository,
  UserRepository,
  UserSessionRepository,
  UserSsoProviderRepository,
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
    public readonly projectInterviewQuestions: IProjectInterviewQuestionRepository,
    public readonly projectRequiredSkills: IProjectRequiredSkillRepository,
    public readonly projectStatusHistory: IProjectStatusHistoryRepository,
    public readonly tasks: ITaskRepository,
    public readonly taskDisputes: ITaskDisputeRepository,
    public readonly taskHistory: ITaskHistoryRepository,
    public readonly taskComments: ITaskCommentRepository,
    public readonly taskCommentAttachments: ITaskCommentAttachmentRepository,
    public readonly aiTaskSessions: IAiTaskSessionRepository,
    public readonly aiSessionMessages: IAiSessionMessageRepository,
    public readonly projectApplications: IProjectApplicationRepository,
    public readonly interviewAnswers: IInterviewAnswerRepository,
    public readonly projectMembers: IProjectMemberRepository,
    public readonly notifications: INotificationRepository,
    public readonly billingPeriods: IBillingPeriodRepository,
    public readonly invoices: IInvoiceRepository,
    public readonly invoiceLineItems: IInvoiceLineItemRepository,
    public readonly consultantTransactions: IConsultantTransactionRepository,
    public readonly businessTransactions: IBusinessTransactionRepository,
    public readonly webhookEvents: IWebhookEventRepository,
    public readonly files: IFileRepository,
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
    public readonly projectInterviewQuestions: ProjectInterviewQuestionRepository,
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
    public readonly projectApplications: ProjectApplicationRepository,
    public readonly interviewAnswers: InterviewAnswerRepository,
    public readonly projectMembers: ProjectMemberRepository,
    // Domain 7 — Notifications
    public readonly notifications: NotificationRepository,
    // Domain 8 — Finance
    public readonly billingPeriods: BillingPeriodRepository,
    public readonly invoices: InvoiceRepository,
    public readonly invoiceLineItems: InvoiceLineItemRepository,
    public readonly consultantTransactions: ConsultantTransactionRepository,
    public readonly businessTransactions: BusinessTransactionRepository,
    public readonly webhookEvents: WebhookEventRepository,
    // Domain 9 — Files
    public readonly files: FileRepository,
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
        this.projectInterviewQuestions.withManager(manager),
        this.projectRequiredSkills.withManager(manager),
        this.projectStatusHistory.withManager(manager),
        this.tasks.withManager(manager),
        this.taskDisputes.withManager(manager),
        this.taskHistory.withManager(manager),
        this.taskComments.withManager(manager),
        this.taskCommentAttachments.withManager(manager),
        this.aiTaskSessions.withManager(manager),
        this.aiSessionMessages.withManager(manager),
        this.projectApplications.withManager(manager),
        this.interviewAnswers.withManager(manager),
        this.projectMembers.withManager(manager),
        this.notifications.withManager(manager),
        this.billingPeriods.withManager(manager),
        this.invoices.withManager(manager),
        this.invoiceLineItems.withManager(manager),
        this.consultantTransactions.withManager(manager),
        this.businessTransactions.withManager(manager),
        this.webhookEvents.withManager(manager),
        this.files.withManager(manager),
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
