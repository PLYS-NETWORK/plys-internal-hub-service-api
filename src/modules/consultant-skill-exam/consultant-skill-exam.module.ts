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
import { SkillExamExpirySweeperService } from './services/skill-exam-expiry-sweeper.service';

@Module({
  imports: [
    UnitOfWorkModule,
    EmailModule,
    CopyleaksModule,
    ServerAiModule,
    // Queue rate-limit + retry policy:
    //   - `limiter`: at most 5 jobs/sec across the whole queue. CopyLeaks + AI
    //     calls are slow and rate-limited upstream — without this, a burst of
    //     submissions would either fail or hammer the providers.
    //   - `defaultJobOptions.attempts` + `backoff`: 3 attempts with exponential
    //     backoff (5s, 25s, 125s). Job handlers are idempotent (they short-circuit
    //     on wrong-status), so safe.
    //   - `removeOnComplete`/`removeOnFail`: keep a bounded history for ops.
    BullModule.registerQueue({
      name: SKILL_EXAM_QUEUE,
      limiter: { max: 5, duration: 1_000, bounceBack: false },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 1_000, age: 7 * 24 * 3_600 },
        removeOnFail: { count: 5_000 },
      },
    }),
  ],
  controllers: [ConsultantSkillExamController],
  providers: [
    ConsultantSkillExamService,
    SkillExamAiEvaluationService,
    SkillExamCopyleaksService,
    SkillExamProcessor,
    // 5-min cron that EXPIRES stale IN_PROGRESS exams. See service file for why
    // both lazy + sweep are needed.
    SkillExamExpirySweeperService,
    OnboardingApprovedGuard,
    NotBannedGuard,
  ],
  exports: [ConsultantSkillExamService, SkillExamAiEvaluationService, SkillExamCopyleaksService],
})
export class ConsultantSkillExamModule {}
