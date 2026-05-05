import { Module } from '@nestjs/common';

import {
  AiProviderApiKeyRepository,
  AiSessionMessageRepository,
  AiTaskSessionRepository,
  AuthTokenRepository,
  BillingPeriodRepository,
  BusinessProfileRepository,
  BusinessTransactionRepository,
  ChatMessageRepository,
  ConsultantProfileRepository,
  ConsultantSkillRepository,
  ConsultantTransactionRepository,
  FileRepository,
  IdempotencyKeyRepository,
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
  TaskCodeService,
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
  ProjectMemberRepository,
  ProjectChatSessionRepository,
  ChatMessageRepository,
  ProjectAiContextRepository,
  // Domain 4 — Tasks
  TaskRepository,
  TaskDisputeRepository,
  TaskHistoryRepository,
  TaskEvidenceRepository,
  TaskEvidenceAttachmentRepository,
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
];

@Module({
  providers: [UnitOfWorkService, TransactionNumberService, TaskCodeService, ...repositories],
  exports: [UnitOfWorkService, TransactionNumberService, TaskCodeService],
})
export class UnitOfWorkModule {}
