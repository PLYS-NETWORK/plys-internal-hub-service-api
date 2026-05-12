import { CopyleaksModule } from '@common/modules/copyleaks';
import { EmailModule } from '@common/modules/email';
import { ServerAiModule } from '@common/modules/server-ai/server-ai.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { UnitOfWorkModule } from '../unit-of-work/unit-of-work.module';

// TODO(refactor): implement the per-skill exam flow per
// docs/api-specs/consultant-skill-exam/consultant.md
//
// Required files (per plan):
// - controllers/consultant-skill-exam.controller.ts
// - services/consultant-skill-exam.service.ts
// - services/skill-exam-copyleaks.service.ts
// - services/skill-exam-ai-evaluation.service.ts
// - processors/skill-exam.processor.ts
// - guards/onboarding-approved.guard.ts
// - guards/not-banned.guard.ts
// - constants: SKILL_EXAM_QUEUE, jobs, thresholds (PASS=80, EXPERT=90,
//   COPYLEAKS_PASS_MAX_AI_SCORE=30, COOLDOWN_DAYS=7, MAX_PARALLEL_EXAMS=2,
//   BAN_STRIKE_THRESHOLD=3, TOTAL_SKILL_EXAM_QUESTIONS=20)
// - dto/* (start-skill-exam, submit-skill-exam-answer; list/detail responses)
//
// Endpoints to expose under /consultant/skill-exams (Bearer + @Roles(USER) +
// @Platform(CONSULTANT) + OnboardingApprovedGuard + NotBannedGuard):
//   GET    /
//   POST   /                { skill_id }  → validates: not banned, onboarding APPROVED,
//                                          <2 in-progress, latest cooldown clear, not already passed
//                                          → enqueues GENERATE_SKILL_EXAM_QUESTIONS
//   GET    /:examId
//   POST   /:examId/answers
//   POST   /:examId/submit  → enqueues RUN_SKILL_EXAM_COPYLEAKS
//
// Processor jobs:
//   GENERATE_SKILL_EXAM_QUESTIONS: ServerAiService.complete(INTERVIEW) → write 20 questions
//   RUN_SKILL_EXAM_COPYLEAKS:      CopyleaksService.checkTextsForAi(20 answers); on AI-detect
//                                   → strike+1, ban if ≥3, COPYLEAKS_FAILED + cooldown+7d
//   RUN_SKILL_EXAM_AI_EVAL:        ServerAiService.complete(EVALUATE_ANSWER); compute final %
//                                   <80 → FAILED + cooldown; 80-89 → PASSED + ADVANCED;
//                                   ≥90 → PASSED + EXPERT + hasNotificationPriority=true
//                                   On PASSED (in transaction): upsert ConsultantSkill
//                                   {proficiencyLevel, rating: finalScore}; insert
//                                   ConsultantSkillScore; recompute ConsultantProfile.avgRating
//                                   = AVG(consultant_skills.rating WHERE consultant_id=?).
@Module({
  imports: [
    UnitOfWorkModule,
    EmailModule,
    CopyleaksModule,
    ServerAiModule,
    BullModule.registerQueue({ name: 'consultant-skill-exam' }),
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class ConsultantSkillExamModule {}
