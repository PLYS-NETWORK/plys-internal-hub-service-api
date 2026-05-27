import { InjectQueue } from '@nestjs/bull';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import {
  IConsultantSkillExamSubmittedEvent,
  NOTIFICATION_EVENTS,
} from '@plys/libraries/common-nest/events';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { DateUtil } from '@plys/libraries/common-nest/utils/date';
import { ConsultantSkillExam, Skill } from '@plys/libraries/database/entities';
import {
  SKILL_EXAM_IN_PROGRESS_STATUSES,
  SkillExamFailReason,
  SkillExamStatus,
  toConsultantViewStatus,
} from '@plys/libraries/database/enums';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';
import { Queue } from 'bull';
import { plainToInstance } from 'class-transformer';

import {
  EXAM_TAKING_COOLDOWN_DAYS,
  EXPIRED_RETRY_LIMIT,
  ISkillExamJobPayload,
  MAX_PARALLEL_EXAMS,
  SKILL_EXAM_JOBS,
  SKILL_EXAM_QUEUE,
  TOTAL_SKILL_EXAM_QUESTIONS,
} from '../consultant-skill-exam.constants';
import { StartSkillExamDto } from '../dto/requests/start-skill-exam.dto';
import { SubmitSkillExamAnswerDto } from '../dto/requests/submit-skill-exam-answer.dto';
import {
  ISkillExamEligibilityDetails,
  SkillExamEligibilityBlockReason,
} from '../dto/responses/interfaces/skill-exam-eligibility.response.interface';
import { SkillExamDetailResponseDto } from '../dto/responses/skill-exam-detail-response.dto';
import { SkillExamEligibilityResponseDto } from '../dto/responses/skill-exam-eligibility-response.dto';
import { SkillExamSummaryResponseDto } from '../dto/responses/skill-exam-summary-response.dto';
import { IConsultantSkillExamService } from '../interfaces/consultant-skill-exam.service.interface';
import { assertSkillExamAccessAllowed } from '../utils/skill-exam-access.util';

@Injectable()
export class ConsultantSkillExamService implements IConsultantSkillExamService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: ProfilesUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(SKILL_EXAM_QUEUE)
    private readonly queue: Queue<ISkillExamJobPayload>,
  ) {
    this.logger = new AppLogger(ConsultantSkillExamService.name, requestContext);
  }

  /** @inheritdoc */
  public async getCurrent(): Promise<SkillExamSummaryResponseDto | null> {
    const userId = this.requestContext.userId!;
    await assertSkillExamAccessAllowed(this.uow, userId);
    this.logger.log(`[${this.rid}] getCurrent — start | userId: ${userId}`);

    const profile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!profile) return null;

    let exam = await this.uow.consultantSkillExams.findCurrentByConsultant(profile.id);
    if (!exam) return null;

    // Lazy-expire: if the consultant's only active exam is past its 60-min
    // deadline, transition it to EXPIRED before responding so the UI sees the
    // terminal state immediately.
    if (this.isPastDeadline(exam)) {
      await this.expireExam(exam.id);
      exam = await this.uow.consultantSkillExams.findById(exam.id);
      if (!exam) return null;
    }

    const skill = await this.uow.skills.findById(exam.skillId);
    return this.toSummary(exam, skill);
  }

  /** @inheritdoc */
  public async getEligibility(): Promise<SkillExamEligibilityResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] getEligibility — start | userId: ${userId}`);

    const user = await this.uow.users.findById(userId);
    if (!user) {
      return this.toEligibilityDto(false, 'onboarding_not_approved', {});
    }

    // Banned account — surfaced even though NotBannedGuard usually blocks first,
    // so the controller still returns a consistent payload if guards are bypassed.
    if (!user.isActive) {
      return this.toEligibilityDto(false, 'banned', {
        ban_reason: user.banReason ?? undefined,
      });
    }

    // Platform-wide 2-day pause from 3 expired attempts.
    if (user.examTakingBlockedUntil && user.examTakingBlockedUntil > new Date()) {
      return this.toEligibilityDto(false, 'platform_block', {
        blocked_until: DateUtil.toZonedIso(user.examTakingBlockedUntil, this.tz()) ?? undefined,
        exam_expired_count: user.examExpiredCount,
      });
    }

    const profile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!profile) {
      return this.toEligibilityDto(false, 'onboarding_not_approved', {});
    }

    // Active or pending-review exam? Block the start button.
    let current = await this.uow.consultantSkillExams.findCurrentByConsultant(profile.id);
    if (current && this.isPastDeadline(current)) {
      // Auto-expire stale ones so eligibility isn't blocked by ghosts.
      await this.expireExam(current.id);
      current = await this.uow.consultantSkillExams.findCurrentByConsultant(profile.id);
    }
    if (current) {
      return this.toEligibilityDto(false, 'pending_exam', { pending_exam_id: current.id });
    }

    return this.toEligibilityDto(true, null, {});
  }

  /** @inheritdoc */
  public async start(dto: StartSkillExamDto): Promise<SkillExamSummaryResponseDto> {
    const userId = this.requestContext.userId!;
    await assertSkillExamAccessAllowed(this.uow, userId);
    this.logger.log(`[${this.rid}] start — start | userId: ${userId} | skillId: ${dto.skill_id}`);

    return this.uow.withTransaction(async (tx) => {
      const profile = await tx.consultantProfiles.findByUserId(userId);
      if (!profile) {
        throw new TranslatableException({
          messageKey: 'error.consultant_profile.not_found',
          errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      // Platform-wide block: 2-day pause from 3 expired attempts.
      const user = await tx.users.findById(userId);
      if (!user) {
        throw new TranslatableException({
          messageKey: 'error.auth.user_not_found',
          errorCode: ERROR_CODES.AUTH_USER_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      if (user.examTakingBlockedUntil && user.examTakingBlockedUntil > new Date()) {
        this.logger.warn(
          `[${this.rid}] start — platform block | userId: ${userId} | until: ${user.examTakingBlockedUntil.toISOString()}`,
        );
        throw new TranslatableException({
          messageKey: 'error.skill_exam.taking_blocked',
          errorCode: ERROR_CODES.SKILL_EXAM_TAKING_BLOCKED,
          status: HttpStatus.FORBIDDEN,
          details: {
            blocked_until: DateUtil.toZonedIso(user.examTakingBlockedUntil, this.tz()) ?? undefined,
          },
        });
      }
      // Cooldown just expired but counter still high — reset so the consultant
      // gets a fresh window without needing a passing exam to unlock.
      if (
        user.examExpiredCount >= EXPIRED_RETRY_LIMIT &&
        (!user.examTakingBlockedUntil || user.examTakingBlockedUntil <= new Date())
      ) {
        user.examExpiredCount = 0;
        user.examTakingBlockedUntil = null;
        await tx.users.save(user);
      }

      // Skill must exist.
      const skill = await tx.skills.findById(dto.skill_id);
      if (!skill) {
        throw new TranslatableException({
          messageKey: 'error.project.skill_not_found',
          errorCode: ERROR_CODES.PROJECT_SKILL_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      // 1-exam-at-a-time gate (MAX_PARALLEL_EXAMS = 1).
      const inProgress = await tx.consultantSkillExams.countInProgressByConsultant(profile.id);
      if (inProgress >= MAX_PARALLEL_EXAMS) {
        throw new TranslatableException({
          messageKey: 'error.skill_exam.parallel_limit_reached',
          errorCode: ERROR_CODES.SKILL_EXAM_PARALLEL_LIMIT_REACHED,
          status: HttpStatus.CONFLICT,
        });
      }

      const latest = await tx.consultantSkillExams.findLatestByConsultantAndSkill(
        profile.id,
        dto.skill_id,
      );
      if (latest) {
        if (latest.status === SkillExamStatus.PASSED) {
          throw new TranslatableException({
            messageKey: 'error.skill_exam.already_passed',
            errorCode: ERROR_CODES.SKILL_EXAM_ALREADY_PASSED,
            status: HttpStatus.CONFLICT,
          });
        }
        if (SKILL_EXAM_IN_PROGRESS_STATUSES.includes(latest.status)) {
          throw new TranslatableException({
            messageKey: 'error.skill_exam.already_in_progress',
            errorCode: ERROR_CODES.SKILL_EXAM_ALREADY_IN_PROGRESS,
            status: HttpStatus.CONFLICT,
          });
        }
        if (latest.cooldownUntil && latest.cooldownUntil > new Date()) {
          throw new TranslatableException({
            messageKey: 'error.skill_exam.cooldown_active',
            errorCode: ERROR_CODES.SKILL_EXAM_COOLDOWN_ACTIVE,
            status: HttpStatus.UNPROCESSABLE_ENTITY,
            details: {
              cooldown_until: DateUtil.toZonedIso(latest.cooldownUntil, this.tz()) ?? undefined,
            },
          });
        }
      }

      const attemptNumber =
        (await tx.consultantSkillExams.countAttemptsByConsultantAndSkill(
          profile.id,
          dto.skill_id,
        )) + 1;

      const exam = tx.consultantSkillExams.create({
        consultantId: profile.id,
        skillId: dto.skill_id,
        status: SkillExamStatus.GENERATING_QUESTIONS,
        attemptNumber,
      });
      const saved = (await tx.consultantSkillExams.save(exam)) as ConsultantSkillExam;

      // Enqueue the AI question-generation job.
      await this.queue.add(SKILL_EXAM_JOBS.GENERATE_SKILL_EXAM_QUESTIONS, { exam_id: saved.id });

      this.logger.log(
        `[${this.rid}] start — complete | examId: ${saved.id} | attempt: ${attemptNumber}`,
      );
      return this.toSummary(saved, skill);
    });
  }

  /** @inheritdoc */
  public async getDetail(examId: string): Promise<SkillExamDetailResponseDto> {
    await assertSkillExamAccessAllowed(this.uow, this.requestContext.userId!);
    let exam = await this.loadOwnedExam(examId);

    // Lazy expiry on read so the UI sees the EXPIRED transition immediately.
    // Don't throw — let the consultant view their final state on the same call.
    if (this.isPastDeadline(exam)) {
      await this.expireExam(exam.id);
      const refreshed = await this.uow.consultantSkillExams.findById(examId);
      if (refreshed) exam = refreshed;
    }

    const [questions, answers, skill] = await Promise.all([
      this.uow.consultantSkillExamQuestions.findByExamId(examId),
      this.uow.consultantSkillExamAnswers.findByExamId(examId),
      this.uow.skills.findById(exam.skillId),
    ]);
    const answerByQuestion = new Map(answers.map((a) => [a.examQuestionId, a.answerText]));

    const summary = this.toSummary(exam, skill);
    return plainToInstance(
      SkillExamDetailResponseDto,
      {
        ...summary,
        questions: questions.map((q) => ({
          id: q.id,
          exam_question_id: q.id,
          question_order: q.questionOrder,
          content: q.content,
          answer_text: answerByQuestion.get(q.id) ?? null,
        })),
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async submitAnswer(examId: string, dto: SubmitSkillExamAnswerDto): Promise<void> {
    await assertSkillExamAccessAllowed(this.uow, this.requestContext.userId!);
    this.logger.log(
      `[${this.rid}] submitAnswer — start | examId: ${examId} | questionId: ${dto.exam_question_id}`,
    );

    // Lazy expiry — block any write past the deadline.
    const examPre = await this.loadOwnedExam(examId);
    if (this.isPastDeadline(examPre)) {
      await this.expireExam(examPre.id);
      throw new TranslatableException({
        messageKey: 'error.skill_exam.expired',
        errorCode: ERROR_CODES.SKILL_EXAM_EXPIRED,
        status: HttpStatus.CONFLICT,
      });
    }

    await this.uow.withTransaction(async (tx) => {
      const exam = await tx.consultantSkillExams.findById(examId);
      if (!exam) {
        throw new TranslatableException({
          messageKey: 'error.skill_exam.not_found',
          errorCode: ERROR_CODES.SKILL_EXAM_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      const profile = await tx.consultantProfiles.findByUserId(this.requestContext.userId!);
      if (!profile || profile.id !== exam.consultantId) {
        throw new TranslatableException({
          messageKey: 'error.skill_exam.not_found',
          errorCode: ERROR_CODES.SKILL_EXAM_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      if (exam.status !== SkillExamStatus.IN_PROGRESS) {
        throw new TranslatableException({
          messageKey: 'error.skill_exam.invalid_status',
          errorCode: ERROR_CODES.SKILL_EXAM_INVALID_STATUS,
          status: HttpStatus.CONFLICT,
        });
      }

      const question = await tx.consultantSkillExamQuestions.findById(dto.exam_question_id);
      if (!question || question.examId !== exam.id) {
        throw new TranslatableException({
          messageKey: 'error.skill_exam.not_found',
          errorCode: ERROR_CODES.SKILL_EXAM_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      const existing = await tx.consultantSkillExamAnswers.findOne({
        where: { examQuestionId: dto.exam_question_id },
      });
      const now = new Date();
      if (existing) {
        existing.answerText = dto.answer_text;
        existing.submittedAt = now;
        await tx.consultantSkillExamAnswers.save(existing);
      } else {
        const row = tx.consultantSkillExamAnswers.create({
          examQuestionId: dto.exam_question_id,
          answerText: dto.answer_text,
          submittedAt: now,
        });
        await tx.consultantSkillExamAnswers.save(row);
      }
    });
  }

  /** @inheritdoc */
  public async submit(examId: string): Promise<void> {
    await assertSkillExamAccessAllowed(this.uow, this.requestContext.userId!);
    this.logger.log(`[${this.rid}] submit — start | examId: ${examId}`);

    // Lazy expiry — refuse the submit if the deadline already passed.
    const examPre = await this.loadOwnedExam(examId);
    if (this.isPastDeadline(examPre)) {
      await this.expireExam(examPre.id);
      throw new TranslatableException({
        messageKey: 'error.skill_exam.expired',
        errorCode: ERROR_CODES.SKILL_EXAM_EXPIRED,
        status: HttpStatus.CONFLICT,
      });
    }

    const result = await this.uow.withTransaction(async (tx) => {
      const exam = await tx.consultantSkillExams.findById(examId);
      if (!exam) {
        throw new TranslatableException({
          messageKey: 'error.skill_exam.not_found',
          errorCode: ERROR_CODES.SKILL_EXAM_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      const profile = await tx.consultantProfiles.findByUserId(this.requestContext.userId!);
      if (!profile || profile.id !== exam.consultantId) {
        throw new TranslatableException({
          messageKey: 'error.skill_exam.not_found',
          errorCode: ERROR_CODES.SKILL_EXAM_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      if (exam.status !== SkillExamStatus.IN_PROGRESS) {
        throw new TranslatableException({
          messageKey: 'error.skill_exam.invalid_status',
          errorCode: ERROR_CODES.SKILL_EXAM_INVALID_STATUS,
          status: HttpStatus.CONFLICT,
        });
      }

      const answers = await tx.consultantSkillExamAnswers.findByExamId(exam.id);
      if (answers.length < TOTAL_SKILL_EXAM_QUESTIONS) {
        throw new TranslatableException({
          messageKey: 'error.skill_exam.incomplete_answers',
          errorCode: ERROR_CODES.SKILL_EXAM_INCOMPLETE_ANSWERS,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          details: { answered: answers.length, required: TOTAL_SKILL_EXAM_QUESTIONS },
        });
      }

      exam.status = SkillExamStatus.SUBMITTED;
      exam.submittedAt = new Date();
      await tx.consultantSkillExams.save(exam);

      const skill = await tx.skills.findById(exam.skillId);
      return {
        examId: exam.id,
        skillId: exam.skillId,
        skillName: skill?.name ?? '',
        consultantUserId: profile.userId,
      };
    });

    // Enqueue Copyleaks (outside the transaction) + emit submitted notification.
    await this.queue.add(SKILL_EXAM_JOBS.RUN_SKILL_EXAM_COPYLEAKS, { exam_id: result.examId });

    const payload: IConsultantSkillExamSubmittedEvent = {
      consultant_user_id: result.consultantUserId,
      exam_id: result.examId,
      skill_id: result.skillId,
      skill_name: result.skillName,
    };
    this.eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_SUBMITTED, payload);

    this.logger.log(`[${this.rid}] submit — complete | examId: ${result.examId}`);
  }

  /** @inheritdoc */
  public async expireExam(examId: string): Promise<void> {
    this.logger.log(`[${this.rid}] expireExam — start | examId: ${examId}`);

    const result = await this.uow.withTransaction(async (tx) => {
      const exam = await tx.consultantSkillExams.findById(examId);
      if (!exam) return null;
      // Idempotent — if the row already reached a terminal state via another
      // path (concurrent submit, parallel sweep), bail without mutating.
      if (exam.status !== SkillExamStatus.IN_PROGRESS) return null;

      const now = new Date();
      exam.status = SkillExamStatus.EXPIRED;
      exam.failReason = SkillExamFailReason.EXPIRED;
      exam.concludedAt = now;
      await tx.consultantSkillExams.save(exam);

      const profile = await tx.consultantProfiles.findById(exam.consultantId);
      if (!profile) return null;
      const user = await tx.users.findById(profile.userId);
      if (!user) return null;

      user.examExpiredCount = (user.examExpiredCount ?? 0) + 1;
      if (user.examExpiredCount >= EXPIRED_RETRY_LIMIT) {
        const blockUntil = new Date(now);
        blockUntil.setDate(blockUntil.getDate() + EXAM_TAKING_COOLDOWN_DAYS);
        user.examTakingBlockedUntil = blockUntil;
      }
      await tx.users.save(user);

      const skill = await tx.skills.findById(exam.skillId);
      return {
        consultantUserId: profile.userId,
        skillId: exam.skillId,
        skillName: skill?.name ?? '',
        examExpiredCount: user.examExpiredCount,
        blockedUntilIso: user.examTakingBlockedUntil?.toISOString() ?? null,
      };
    });

    if (!result) {
      this.logger.warn(`[${this.rid}] expireExam — noop | examId: ${examId}`);
      return;
    }

    // Emit a FAILED event with fail_reason='EXPIRED' so the consultant-side and
    // admin-fan-out notifications both pick up the EXPIRED branch.
    this.eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_FAILED, {
      consultant_user_id: result.consultantUserId,
      exam_id: examId,
      skill_id: result.skillId,
      skill_name: result.skillName,
      fail_reason: 'EXPIRED' as const,
      final_score: 0,
      cooldown_until: null,
      strike_count: 0,
      assigned_proficiency: null,
    });

    this.logger.log(
      `[${this.rid}] expireExam — complete | examId: ${examId} | count: ${result.examExpiredCount} | blockedUntil: ${result.blockedUntilIso ?? 'none'}`,
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** IANA timezone for response rendering; defaults to UTC when absent. */
  private tz(): string {
    return this.requestContext.timezone ?? 'UTC';
  }

  private isPastDeadline(exam: ConsultantSkillExam): boolean {
    return (
      exam.status === SkillExamStatus.IN_PROGRESS &&
      exam.expiresAt !== null &&
      exam.expiresAt <= new Date()
    );
  }

  private async loadOwnedExam(examId: string): Promise<ConsultantSkillExam> {
    const userId = this.requestContext.userId!;
    const exam = await this.uow.consultantSkillExams.findById(examId);
    if (!exam) {
      throw new TranslatableException({
        messageKey: 'error.skill_exam.not_found',
        errorCode: ERROR_CODES.SKILL_EXAM_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    const profile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!profile || profile.id !== exam.consultantId) {
      throw new TranslatableException({
        messageKey: 'error.skill_exam.not_found',
        errorCode: ERROR_CODES.SKILL_EXAM_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    return exam;
  }

  private toSummary(exam: ConsultantSkillExam, skill: Skill | null): SkillExamSummaryResponseDto {
    const tz = this.tz();
    const now = new Date();
    const remainingSeconds =
      exam.status === SkillExamStatus.IN_PROGRESS && exam.expiresAt
        ? Math.max(0, Math.floor((exam.expiresAt.getTime() - now.getTime()) / 1000))
        : null;
    return plainToInstance(
      SkillExamSummaryResponseDto,
      {
        id: exam.id,
        skill_id: exam.skillId,
        skill_name: skill?.name ?? '',
        status: exam.status,
        consultant_view_status: toConsultantViewStatus(exam.status),
        attempt_number: exam.attemptNumber,
        ai_eval_score: exam.aiEvalScore,
        correct_count: exam.correctCount,
        assigned_proficiency: exam.assignedProficiency,
        cooldown_until: DateUtil.toZonedIso(exam.cooldownUntil, tz),
        fail_reason: exam.failReason,
        started_at: DateUtil.toZonedIso(exam.startedAt, tz),
        expires_at: DateUtil.toZonedIso(exam.expiresAt, tz),
        remaining_seconds: remainingSeconds,
        submitted_at: DateUtil.toZonedIso(exam.submittedAt, tz),
        concluded_at: DateUtil.toZonedIso(exam.concludedAt, tz),
        created_at: DateUtil.toZonedIso(exam.createdAt, tz) ?? exam.createdAt.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }

  private toEligibilityDto(
    canRegister: boolean,
    reason: SkillExamEligibilityBlockReason | null,
    details: ISkillExamEligibilityDetails,
  ): SkillExamEligibilityResponseDto {
    return plainToInstance(
      SkillExamEligibilityResponseDto,
      { can_register: canRegister, reason, details },
      { excludeExtraneousValues: true },
    );
  }
}
