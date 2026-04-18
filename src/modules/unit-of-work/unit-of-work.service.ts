import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

import {
  AiSessionMessage,
  AiTaskSession,
  ApplicationAnswer,
  ApplicationAnswerChoice,
  AuthToken,
  BillingPeriod,
  BusinessMember,
  BusinessProfile,
  BusinessTransaction,
  ConsultantProfile,
  ConsultantSkill,
  ConsultantWallet,
  Invoice,
  InvoiceLineItem,
  Notification,
  Project,
  ProjectApplication,
  ProjectMember,
  ProjectRequiredSkill,
  ProjectStatusHistory,
  ScreeningQuestion,
  ScreeningQuestionChoice,
  Skill,
  Task,
  TaskComment,
  TaskCommentAttachment,
  TaskDispute,
  TaskHistory,
  User,
  UserSession,
  UserSsoProvider,
  WalletTransaction,
  WebhookEvent,
} from '../../database/entities';
import { IUnitOfWork } from './interfaces/unit-of-work.interface';

// Resolves repositories either from the application DataSource (root UoW) or
// from a per-transaction EntityManager (TransactionalUnitOfWork). Same shape
// either way, so service code never branches on "am I in a transaction?".
abstract class UoWBase implements IUnitOfWork {
  protected abstract repo<T extends ObjectLiteral>(target: EntityTarget<T>): Repository<T>;

  // Domain 1
  public get users(): Repository<User> {
    return this.repo(User);
  }
  public get authTokens(): Repository<AuthToken> {
    return this.repo(AuthToken);
  }
  public get userSsoProviders(): Repository<UserSsoProvider> {
    return this.repo(UserSsoProvider);
  }
  public get userSessions(): Repository<UserSession> {
    return this.repo(UserSession);
  }

  // Domain 2
  public get businessProfiles(): Repository<BusinessProfile> {
    return this.repo(BusinessProfile);
  }
  public get businessMembers(): Repository<BusinessMember> {
    return this.repo(BusinessMember);
  }
  public get skills(): Repository<Skill> {
    return this.repo(Skill);
  }
  public get consultantProfiles(): Repository<ConsultantProfile> {
    return this.repo(ConsultantProfile);
  }
  public get consultantSkills(): Repository<ConsultantSkill> {
    return this.repo(ConsultantSkill);
  }

  // Domain 3
  public get projects(): Repository<Project> {
    return this.repo(Project);
  }
  public get projectRequiredSkills(): Repository<ProjectRequiredSkill> {
    return this.repo(ProjectRequiredSkill);
  }
  public get projectStatusHistory(): Repository<ProjectStatusHistory> {
    return this.repo(ProjectStatusHistory);
  }

  // Domain 4
  public get tasks(): Repository<Task> {
    return this.repo(Task);
  }
  public get taskDisputes(): Repository<TaskDispute> {
    return this.repo(TaskDispute);
  }
  public get taskHistory(): Repository<TaskHistory> {
    return this.repo(TaskHistory);
  }
  public get taskComments(): Repository<TaskComment> {
    return this.repo(TaskComment);
  }
  public get taskCommentAttachments(): Repository<TaskCommentAttachment> {
    return this.repo(TaskCommentAttachment);
  }

  // Domain 5
  public get aiTaskSessions(): Repository<AiTaskSession> {
    return this.repo(AiTaskSession);
  }
  public get aiSessionMessages(): Repository<AiSessionMessage> {
    return this.repo(AiSessionMessage);
  }

  // Domain 6
  public get screeningQuestions(): Repository<ScreeningQuestion> {
    return this.repo(ScreeningQuestion);
  }
  public get screeningQuestionChoices(): Repository<ScreeningQuestionChoice> {
    return this.repo(ScreeningQuestionChoice);
  }
  public get projectApplications(): Repository<ProjectApplication> {
    return this.repo(ProjectApplication);
  }
  public get applicationAnswers(): Repository<ApplicationAnswer> {
    return this.repo(ApplicationAnswer);
  }
  public get applicationAnswerChoices(): Repository<ApplicationAnswerChoice> {
    return this.repo(ApplicationAnswerChoice);
  }
  public get projectMembers(): Repository<ProjectMember> {
    return this.repo(ProjectMember);
  }

  // Domain 7
  public get notifications(): Repository<Notification> {
    return this.repo(Notification);
  }

  // Domain 8
  public get billingPeriods(): Repository<BillingPeriod> {
    return this.repo(BillingPeriod);
  }
  public get invoices(): Repository<Invoice> {
    return this.repo(Invoice);
  }
  public get invoiceLineItems(): Repository<InvoiceLineItem> {
    return this.repo(InvoiceLineItem);
  }
  public get consultantWallets(): Repository<ConsultantWallet> {
    return this.repo(ConsultantWallet);
  }
  public get walletTransactions(): Repository<WalletTransaction> {
    return this.repo(WalletTransaction);
  }
  public get businessTransactions(): Repository<BusinessTransaction> {
    return this.repo(BusinessTransaction);
  }
  public get webhookEvents(): Repository<WebhookEvent> {
    return this.repo(WebhookEvent);
  }

  public abstract withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T>;
}

@Injectable()
export class UnitOfWorkService extends UoWBase {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  protected repo<T extends ObjectLiteral>(target: EntityTarget<T>): Repository<T> {
    return this.dataSource.getRepository(target);
  }

  public async withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const txUow = new TransactionalUnitOfWork(queryRunner.manager);
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

// Scoped UoW shared across one transaction. Repositories resolved from the
// shared EntityManager so every read/write joins the same query runner.
class TransactionalUnitOfWork extends UoWBase {
  constructor(private readonly manager: EntityManager) {
    super();
  }

  protected repo<T extends ObjectLiteral>(target: EntityTarget<T>): Repository<T> {
    return this.manager.getRepository(target);
  }

  public async withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    return work(this);
  }
}
