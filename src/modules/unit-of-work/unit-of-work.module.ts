import { Module } from '@nestjs/common';

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
  IdempotencyKeyRepository,
  InterviewQuestionRepository,
  InvoiceLineItemRepository,
  InvoiceRepository,
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
import { UnitOfWorkService } from './unit-of-work.service';

const repositories = [
  // Domain 0 — Admin
  AdminAllowedEmailRepository,
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
  ProjectMemberRepository,
  ProjectChatSessionRepository,
  ChatMessageRepository,
  ProjectAiContextRepository,
  // Domain 4 — Tasks
  TaskRepository,
  TaskAttachmentRepository,
  TaskDisputeRepository,
  TaskHistoryRepository,
  TaskResultRepository,
  TaskResultAttachmentRepository,
  // Domain 5 — AI
  AiTaskSessionRepository,
  AiSessionMessageRepository,
  // Domain 6 — Finance
  BillingPeriodRepository,
  InvoiceRepository,
  InvoiceLineItemRepository,
  ConsultantTransactionRepository,
  BusinessTransactionRepository,
  WebhookEventRepository,
  // Domain 7 — Files
  FileRepository,
  // Domain 8 — Notifications
  NotificationRepository,
  // Domain 9 — Infra (cross-cutting)
  IdempotencyKeyRepository,
  AiProviderApiKeyRepository,
  // Domain 10 — Applications
  ConsultantApplicationRepository,
  InterviewQuestionRepository,
  ConsultantApplicationQuestionRepository,
  ConsultantApplicationAnswerRepository,
  ConsultantSkillScoreRepository,
  // Domain 11 — Contact
  ContactInquiryRepository,
];

@Module({
  providers: [UnitOfWorkService, TransactionNumberService, TaskCodeService, ...repositories],
  exports: [UnitOfWorkService, TransactionNumberService, TaskCodeService],
})
export class UnitOfWorkModule {}
