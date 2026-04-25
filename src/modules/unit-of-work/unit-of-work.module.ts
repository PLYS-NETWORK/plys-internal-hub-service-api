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
  ProjectApplicationRepository,
  ProjectInterviewQuestionRepository,
  ProjectMemberRepository,
  ProjectRepository,
  ProjectRequiredSkillRepository,
  SkillRepository,
  TaskCommentAttachmentRepository,
  TaskCommentRepository,
  TaskDisputeRepository,
  TaskEvidenceAttachmentRepository,
  TaskEvidenceRepository,
  TaskHistoryRepository,
  TaskRepository,
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
];

@Module({
  providers: [UnitOfWorkService, ...repositories],
  exports: [UnitOfWorkService],
})
export class UnitOfWorkModule {}
