import { Module } from '@nestjs/common';

import {
  AiSessionMessageRepository,
  AiTaskSessionRepository,
  AuthTokenRepository,
  BillingPeriodRepository,
  BusinessProfileRepository,
  BusinessTransactionRepository,
  ConsultantProfileRepository,
  ConsultantSkillRepository,
  ConsultantWalletRepository,
  InterviewAnswerRepository,
  InvoiceLineItemRepository,
  InvoiceRepository,
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
  WalletTransactionRepository,
  WebhookEventRepository,
} from './repositories';
import { UnitOfWorkService } from './unit-of-work.service';

const repositories = [
  // Domain 1 — Auth & Identity
  UserRepository,
  AuthTokenRepository,
  UserSsoProviderRepository,
  UserSessionRepository,
  // Domain 2 — Profiles
  BusinessProfileRepository,
  SkillRepository,
  ConsultantProfileRepository,
  ConsultantSkillRepository,
  // Domain 3 — Projects
  ProjectRepository,
  ProjectRequiredSkillRepository,
  ProjectStatusHistoryRepository,
  // Domain 4 — Tasks
  TaskRepository,
  TaskDisputeRepository,
  TaskHistoryRepository,
  TaskCommentRepository,
  TaskCommentAttachmentRepository,
  // Domain 5 — AI
  AiTaskSessionRepository,
  AiSessionMessageRepository,
  // Domain 6 — Applications
  ProjectApplicationRepository,
  InterviewAnswerRepository,
  ProjectMemberRepository,
  // Domain 7 — Notifications
  NotificationRepository,
  // Domain 8 — Finance
  BillingPeriodRepository,
  InvoiceRepository,
  InvoiceLineItemRepository,
  ConsultantWalletRepository,
  WalletTransactionRepository,
  BusinessTransactionRepository,
  WebhookEventRepository,
  ProjectInterviewQuestionRepository,
];

@Module({
  providers: [UnitOfWorkService, ...repositories],
  exports: [UnitOfWorkService],
})
export class UnitOfWorkModule {}
