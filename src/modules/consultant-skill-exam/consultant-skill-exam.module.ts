import { CopyleaksModule } from '@common/modules/copyleaks';
import { EmailModule } from '@common/modules/email';
import { ServerAiModule } from '@common/modules/server-ai/server-ai.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { UnitOfWorkModule } from '../unit-of-work/unit-of-work.module';
import { SKILL_EXAM_QUEUE } from './consultant-skill-exam.constants';
import { ConsultantSkillExamController } from './controllers/consultant-skill-exam.controller';
import { NotBannedGuard } from './guards/not-banned.guard';
import { OnboardingApprovedGuard } from './guards/onboarding-approved.guard';
import { SkillExamProcessor } from './processors/skill-exam.processor';
import { ConsultantSkillExamService } from './services/consultant-skill-exam.service';
import { SkillExamAiEvaluationService } from './services/skill-exam-ai-evaluation.service';
import { SkillExamCopyleaksService } from './services/skill-exam-copyleaks.service';

@Module({
  imports: [
    UnitOfWorkModule,
    EmailModule,
    CopyleaksModule,
    ServerAiModule,
    BullModule.registerQueue({ name: SKILL_EXAM_QUEUE }),
  ],
  controllers: [ConsultantSkillExamController],
  providers: [
    ConsultantSkillExamService,
    SkillExamAiEvaluationService,
    SkillExamCopyleaksService,
    SkillExamProcessor,
    OnboardingApprovedGuard,
    NotBannedGuard,
  ],
  exports: [ConsultantSkillExamService, SkillExamAiEvaluationService, SkillExamCopyleaksService],
})
export class ConsultantSkillExamModule {}
