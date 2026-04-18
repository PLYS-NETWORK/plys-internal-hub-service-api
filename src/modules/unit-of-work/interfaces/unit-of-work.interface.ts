import { Repository } from 'typeorm';

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
} from '../../../database/entities';

// One repository accessor per entity. Service code injects IUnitOfWork instead
// of individual @InjectRepository tokens — that way `withTransaction(...)`
// produces a scoped UoW where every read/write goes through the same
// EntityManager and participates in one atomic unit.
export interface IUnitOfWork {
  // Domain 1 — Auth & Identity
  readonly users: Repository<User>;
  readonly authTokens: Repository<AuthToken>;
  readonly userSsoProviders: Repository<UserSsoProvider>;
  readonly userSessions: Repository<UserSession>;

  // Domain 2 — Profiles
  readonly businessProfiles: Repository<BusinessProfile>;
  readonly businessMembers: Repository<BusinessMember>;
  readonly skills: Repository<Skill>;
  readonly consultantProfiles: Repository<ConsultantProfile>;
  readonly consultantSkills: Repository<ConsultantSkill>;

  // Domain 3 — Projects
  readonly projects: Repository<Project>;
  readonly projectRequiredSkills: Repository<ProjectRequiredSkill>;
  readonly projectStatusHistory: Repository<ProjectStatusHistory>;

  // Domain 4 — Tasks
  readonly tasks: Repository<Task>;
  readonly taskDisputes: Repository<TaskDispute>;
  readonly taskHistory: Repository<TaskHistory>;
  readonly taskComments: Repository<TaskComment>;
  readonly taskCommentAttachments: Repository<TaskCommentAttachment>;

  // Domain 5 — AI
  readonly aiTaskSessions: Repository<AiTaskSession>;
  readonly aiSessionMessages: Repository<AiSessionMessage>;

  // Domain 6 — Applications
  readonly screeningQuestions: Repository<ScreeningQuestion>;
  readonly screeningQuestionChoices: Repository<ScreeningQuestionChoice>;
  readonly projectApplications: Repository<ProjectApplication>;
  readonly applicationAnswers: Repository<ApplicationAnswer>;
  readonly applicationAnswerChoices: Repository<ApplicationAnswerChoice>;
  readonly projectMembers: Repository<ProjectMember>;

  // Domain 7 — Notifications
  readonly notifications: Repository<Notification>;

  // Domain 8 — Finance
  readonly billingPeriods: Repository<BillingPeriod>;
  readonly invoices: Repository<Invoice>;
  readonly invoiceLineItems: Repository<InvoiceLineItem>;
  readonly consultantWallets: Repository<ConsultantWallet>;
  readonly walletTransactions: Repository<WalletTransaction>;
  readonly businessTransactions: Repository<BusinessTransaction>;
  readonly webhookEvents: Repository<WebhookEvent>;

  withTransaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T>;
}
