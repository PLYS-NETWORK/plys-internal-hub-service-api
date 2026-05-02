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
  ConsultantTransactionRepository,
  FileRepository,
  InterviewAnswerRepository,
  InvoiceLineItemRepository,
  InvoiceRepository,
  NotificationRepository,
  ProjectActivityRepository,
  ProjectApplicationRepository,
  ProjectInterviewQuestionRepository,
  ProjectMemberRepository,
  ProjectRepository,
  ProjectRequiredSkillRepository,
  ProjectStatusHistoryRepository,
  SkillRepository,
  TaskCodeService,
  TaskCommentAttachmentRepository,
  TaskCommentRepository,
  TaskDisputeRepository,
  TaskEvidenceAttachmentRepository,
  TaskEvidenceRepository,
  TaskHistoryRepository,
  TaskRepository,
  TransactionNumberService,
  UserRepository,
  UserSessionRepository,
  UserSsoProviderRepository,
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
  ProjectActivityRepository,
  ProjectStatusHistoryRepository,
  // Domain 4 — Tasks
  TaskRepository,
  TaskDisputeRepository,
  TaskHistoryRepository,
  TaskCommentRepository,
  TaskCommentAttachmentRepository,
  TaskEvidenceRepository,
  TaskEvidenceAttachmentRepository,
  // Domain 5 — AI
  AiTaskSessionRepository,
  AiSessionMessageRepository,
  // Domain 6 — Applications
  ProjectApplicationRepository,
  InterviewAnswerRepository,
  ProjectMemberRepository,
  // Domain 8 — Finance
  BillingPeriodRepository,
  InvoiceRepository,
  InvoiceLineItemRepository,
  ConsultantTransactionRepository,
  BusinessTransactionRepository,
  WebhookEventRepository,
  ProjectInterviewQuestionRepository,
  // Domain 9 — Files
  FileRepository,
  // Domain 10 — Notifications
  NotificationRepository,
];

@Module({
  providers: [UnitOfWorkService, TransactionNumberService, TaskCodeService, ...repositories],
  exports: [UnitOfWorkService, TransactionNumberService, TaskCodeService],
})
export class UnitOfWorkModule {}
