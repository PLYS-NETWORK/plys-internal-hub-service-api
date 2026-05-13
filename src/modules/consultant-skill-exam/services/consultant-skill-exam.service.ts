import { ERROR_CODES } from '@common/constants/error-codes';
import { IConsultantSkillExamSubmittedEvent, NOTIFICATION_EVENTS } from '@common/events';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantSkillExam } from '@database/entities';
import { SKILL_EXAM_IN_PROGRESS_STATUSES, SkillExamStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { InjectQueue } from '@nestjs/bull';
import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bull';
import { plainToInstance } from 'class-transformer';

import {
  ISkillExamJobPayload,
  MAX_PARALLEL_EXAMS,
  SKILL_EXAM_JOBS,
  SKILL_EXAM_QUEUE,
  TOTAL_SKILL_EXAM_QUESTIONS,
} from '../consultant-skill-exam.constants';
import { StartSkillExamDto } from '../dto/requests/start-skill-exam.dto';
import { SubmitSkillExamAnswerDto } from '../dto/requests/submit-skill-exam-answer.dto';
import { SkillExamDetailResponseDto } from '../dto/responses/skill-exam-detail-response.dto';
import { SkillExamSummaryResponseDto } from '../dto/responses/skill-exam-summary-response.dto';
import { IConsultantSkillExamService } from '../interfaces/consultant-skill-exam.service.interface';

@Injectable()
export class ConsultantSkillExamService implements IConsultantSkillExamService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(SKILL_EXAM_QUEUE)
    private readonly queue: Queue<ISkillExamJobPayload>,
  ) {
    this.logger = new AppLogger(ConsultantSkillExamService.name, requestContext);
  }

  /** @inheritdoc */
  public async listMine(): Promise<SkillExamSummaryResponseDto[]> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] listMine — start | userId: ${userId}`);
    const profile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!profile) return [];
    const exams = await this.uow.consultantSkillExams.findByConsultant(profile.id);
    return exams.map((e) => this.toSummary(e));
  }

  /** @inheritdoc */
  public async start(dto: StartSkillExamDto): Promise<SkillExamSummaryResponseDto> {
    const userId = this.requestContext.userId!;
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

      // Skill must exist.
      const skill = await tx.skills.findById(dto.skill_id);
      if (!skill) {
        throw new TranslatableException({
          messageKey: 'error.project.skill_not_found',
          errorCode: ERROR_CODES.PROJECT_SKILL_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }

      // Parallel-limit + per-skill state checks.
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
            details: { cooldown_until: latest.cooldownUntil.toISOString() },
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
      return this.toSummary(saved);
    });
  }

  /** @inheritdoc */
  public async getDetail(examId: string): Promise<SkillExamDetailResponseDto> {
    const exam = await this.loadOwnedExam(examId);
    const [questions, answers] = await Promise.all([
      this.uow.consultantSkillExamQuestions.findByExamId(examId),
      this.uow.consultantSkillExamAnswers.findByExamId(examId),
    ]);
    const answerByQuestion = new Map(answers.map((a) => [a.examQuestionId, a.answerText]));

    const summary = this.toSummary(exam);
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
    this.logger.log(
      `[${this.rid}] submitAnswer — start | examId: ${examId} | questionId: ${dto.exam_question_id}`,
    );

    await this.uow.withTransaction(async (tx) => {
      const exam = await tx.consultantSkillExams.findById(examId);
      if (!exam) {
        throw new TranslatableException({
          messageKey: 'error.skill_exam.not_found',
          errorCode: ERROR_CODES.SKILL_EXAM_NOT_FOUND,
          status: HttpStatus.NOT_FOUND,
        });
      }
      // Ownership check via consultant profile.
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
    this.logger.log(`[${this.rid}] submit — start | examId: ${examId}`);

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

  private toSummary(exam: ConsultantSkillExam): SkillExamSummaryResponseDto {
    return plainToInstance(
      SkillExamSummaryResponseDto,
      {
        id: exam.id,
        skill_id: exam.skillId,
        status: exam.status,
        attempt_number: exam.attemptNumber,
        ai_eval_score: exam.aiEvalScore,
        correct_count: exam.correctCount,
        assigned_proficiency: exam.assignedProficiency,
        cooldown_until: exam.cooldownUntil ? exam.cooldownUntil.toISOString() : null,
        fail_reason: exam.failReason,
        started_at: exam.startedAt ? exam.startedAt.toISOString() : null,
        submitted_at: exam.submittedAt ? exam.submittedAt.toISOString() : null,
        concluded_at: exam.concludedAt ? exam.concludedAt.toISOString() : null,
        created_at: exam.createdAt.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }
}
