import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IConsultantAccountBannedEvent,
  IConsultantSkillExamFailedEvent,
  NOTIFICATION_EVENTS,
} from '@plys/libraries/common-nest/events';
import { CopyleaksService } from '@plys/libraries/common-nest/modules/copyleaks/copyleaks.service';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { BanReason, SkillExamFailReason, SkillExamStatus } from '@plys/libraries/database/enums';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';
import { Queue } from 'bull';

import {
  BAN_STRIKE_THRESHOLD,
  COPYLEAKS_COOLDOWN_DAYS,
  COPYLEAKS_PASS_MAX_AI_SCORE,
  ISkillExamJobPayload,
  SKILL_EXAM_JOBS,
  SKILL_EXAM_QUEUE,
} from '../consultant-skill-exam.constants';
import { ISkillExamCopyleaksService } from '../interfaces/skill-exam-copyleaks.service.interface';

@Injectable()
export class SkillExamCopyleaksService implements ISkillExamCopyleaksService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: ProfilesUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly copyleaks: CopyleaksService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(SKILL_EXAM_QUEUE)
    private readonly queue: Queue<ISkillExamJobPayload>,
  ) {
    this.logger = new AppLogger(SkillExamCopyleaksService.name, requestContext);
  }

  /** @inheritdoc */
  public async run(examId: string): Promise<void> {
    this.logger.log(`[${this.rid}] run — start | examId: ${examId}`);

    const exam = await this.uow.consultantSkillExams.findById(examId);
    if (!exam) {
      this.logger.warn(`[${this.rid}] run — exam not found | examId: ${examId}`);
      return;
    }
    if (exam.status !== SkillExamStatus.SUBMITTED) {
      this.logger.warn(
        `[${this.rid}] run — wrong status | examId: ${examId} | status: ${exam.status}`,
      );
      return;
    }
    exam.status = SkillExamStatus.RUNNING_COPYLEAKS;
    await this.uow.consultantSkillExams.save(exam);

    const answers = await this.uow.consultantSkillExamAnswers.findByExamId(examId);
    const texts = answers.map((a) => a.answerText);
    const result = await this.copyleaks.checkTextsForAi(texts);

    // Persist per-answer scores.
    for (let i = 0; i < answers.length; i++) {
      const aiScore = result.results[i]?.aiScore ?? null;
      answers[i].copyleaksAiScore = aiScore !== null ? aiScore.toFixed(2) : null;
      await this.uow.consultantSkillExamAnswers.save(answers[i]);
    }

    exam.copyleaksAggregateScore = result.maxAiScore.toFixed(2);
    exam.copyleaksCheckedAt = new Date();

    const flaggedAsAi = result.maxAiScore > COPYLEAKS_PASS_MAX_AI_SCORE;
    if (!flaggedAsAi) {
      exam.status = SkillExamStatus.RUNNING_AI_EVAL;
      await this.uow.consultantSkillExams.save(exam);
      await this.queue.add(SKILL_EXAM_JOBS.RUN_SKILL_EXAM_AI_EVAL, { exam_id: examId });
      this.logger.log(`[${this.rid}] run — passed copyleaks | examId: ${examId}`);
      return;
    }

    // AI-content detected — strike, fail, ban-on-3.
    const cooldownUntil = new Date();
    cooldownUntil.setDate(cooldownUntil.getDate() + COPYLEAKS_COOLDOWN_DAYS);
    exam.status = SkillExamStatus.COPYLEAKS_FAILED;
    exam.failReason = SkillExamFailReason.COPYLEAKS_FAILED;
    exam.cooldownUntil = cooldownUntil;
    exam.concludedAt = new Date();

    const result2 = await this.uow.withTransaction(async (tx) => {
      await tx.consultantSkillExams.save(exam);
      const profile = await tx.consultantProfiles.findById(exam.consultantId);
      if (!profile) return null;
      const user = await tx.users.findById(profile.userId);
      if (!user) return null;
      user.aiStrikeCount = (user.aiStrikeCount ?? 0) + 1;
      const justBanned = user.aiStrikeCount >= BAN_STRIKE_THRESHOLD;
      if (justBanned) {
        user.isActive = false;
        user.bannedAt = new Date();
        user.banReason = BanReason.AI_CONTENT_ABUSE;
        // Revoke every active session so the stale JWT is instantly useless —
        // any device hits the isActive=false gate on the next request and gets
        // AUTH_ACCOUNT_INACTIVE. Same pattern as password reset (basic-auth).
        await tx.userSessions.delete({ userId: user.id });
      }
      await tx.users.save(user);
      const skill = await tx.skills.findById(exam.skillId);
      return {
        consultantUserId: profile.userId,
        skillId: exam.skillId,
        skillName: skill?.name ?? '',
        strikeCount: user.aiStrikeCount,
        bannedAt: user.bannedAt?.toISOString() ?? null,
        cooldownUntilIso: cooldownUntil.toISOString(),
      };
    });

    if (!result2) {
      this.logger.error(`[${this.rid}] run — profile/user missing | examId: ${examId}`);
      return;
    }

    // Emit FAILED first so the timeline reads "failed → banned" on the 3rd strike.
    const failedPayload: IConsultantSkillExamFailedEvent = {
      consultant_user_id: result2.consultantUserId,
      exam_id: examId,
      skill_id: result2.skillId,
      skill_name: result2.skillName,
      fail_reason: 'COPYLEAKS_FAILED',
      final_score: 0,
      cooldown_until: result2.cooldownUntilIso,
      strike_count: result2.strikeCount,
      assigned_proficiency: null,
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_FAILED, failedPayload);

    if (result2.strikeCount >= BAN_STRIKE_THRESHOLD && result2.bannedAt) {
      const bannedPayload: IConsultantAccountBannedEvent = {
        consultant_user_id: result2.consultantUserId,
        ban_reason: 'AI_CONTENT_ABUSE',
        banned_at: result2.bannedAt,
      };
      this.eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_ACCOUNT_BANNED, bannedPayload);
    }

    this.logger.log(
      `[${this.rid}] run — copyleaks failed | examId: ${examId} | strike: ${result2.strikeCount}`,
    );
  }
}
