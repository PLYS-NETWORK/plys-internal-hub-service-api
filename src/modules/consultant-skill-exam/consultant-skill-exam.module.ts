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
//
// NOTIFICATION emit-points (consultant-side, in-app + email):
//
// 1) In ConsultantSkillExamService.submit, AFTER persisting `status='SUBMITTED'`
//    and enqueuing the Copyleaks job:
//
//      eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_SUBMITTED, {
//        consultant_user_id: exam.consultant.userId,
//        exam_id: exam.id,
//        skill_id: exam.skillId,
//        skill_name: skill.name,   // i18n key, e.g. 'skill_react'
//      } satisfies IConsultantSkillExamSubmittedEvent);
//
// 2) In SkillExamCopyleaksService (RUN_SKILL_EXAM_COPYLEAKS processor), on
//    AI-content detected branch, AFTER incrementing users.ai_strike_count and
//    committing the status transition:
//
//      eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_FAILED, {
//        consultant_user_id: exam.consultant.userId,
//        exam_id: exam.id,
//        skill_id: exam.skillId,
//        skill_name: skill.name,
//        fail_reason: 'COPYLEAKS_FAILED',
//        final_score: 0,                            // no AI eval ran
//        cooldown_until: cooldownUntil.toISOString(),
//        strike_count: user.aiStrikeCount,
//      } satisfies IConsultantSkillExamFailedEvent);
//
//    If `user.aiStrikeCount === 3` (the strike that just landed flips the
//    account), ADDITIONALLY emit AFTER setting User.isActive=false / bannedAt
//    / banReason='AI_CONTENT_ABUSE':
//
//      eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_ACCOUNT_BANNED, {
//        consultant_user_id: user.id,
//        ban_reason: 'AI_CONTENT_ABUSE',
//        banned_at: user.bannedAt!.toISOString(),
//      } satisfies IConsultantAccountBannedEvent);
//
//    Emit BANNED AFTER FAILED so the FE timeline reads "failed → banned".
//
// 3) In SkillExamAiEvaluationService (RUN_SKILL_EXAM_AI_EVAL processor) after
//    the terminal status transition commits:
//
//    - finalScore < 80:
//        eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_FAILED, {
//          consultant_user_id: exam.consultant.userId,
//          exam_id: exam.id,
//          skill_id: exam.skillId,
//          skill_name: skill.name,
//          fail_reason: 'LOW_SCORE',
//          final_score: finalScore,
//          cooldown_until: cooldownUntil.toISOString(),
//          strike_count: user.aiStrikeCount,
//        } satisfies IConsultantSkillExamFailedEvent);
//
//    - finalScore ≥ 80 (PASSED):
//        eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_PASSED, {
//          consultant_user_id: exam.consultant.userId,
//          exam_id: exam.id,
//          skill_id: exam.skillId,
//          skill_name: skill.name,
//          final_score: finalScore,
//          proficiency_level: finalScore >= 90 ? 'expert' : 'advanced',
//        } satisfies IConsultantSkillExamPassedEvent);
//
//    Pair each emit with the corresponding email send so both channels fire.
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
