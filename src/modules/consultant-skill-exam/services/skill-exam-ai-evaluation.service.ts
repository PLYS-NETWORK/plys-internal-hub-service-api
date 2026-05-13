import {
  IConsultantSkillExamFailedEvent,
  IConsultantSkillExamPassedEvent,
  NOTIFICATION_EVENTS,
} from '@common/events';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ServerAiService } from '@common/modules/server-ai/server-ai.service';
import { ConsultantSkill, ConsultantSkillScore } from '@database/entities';
import {
  AiAssistantType,
  ProficiencyLevel,
  SkillExamFailReason,
  SkillExamStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  ANSWER_CORRECTNESS_THRESHOLD,
  COOLDOWN_DAYS,
  EXPERT_THRESHOLD,
  PASS_THRESHOLD,
  TOTAL_SKILL_EXAM_QUESTIONS,
} from '../consultant-skill-exam.constants';
import { ISkillExamAiEvaluationService } from '../interfaces/skill-exam-ai-evaluation.service.interface';

interface IAiGeneratedQuestion {
  readonly question_order: number;
  readonly content: string;
}

interface IAiEvalAnswerResult {
  readonly order: number;
  readonly score: number;
  readonly is_correct?: boolean;
  readonly feedback?: string;
}

interface IAiEvalResult {
  readonly overall_score: number;
  readonly correct_count?: number;
  readonly answers: IAiEvalAnswerResult[];
}

@Injectable()
export class SkillExamAiEvaluationService implements ISkillExamAiEvaluationService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly serverAi: ServerAiService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new AppLogger(SkillExamAiEvaluationService.name, requestContext);
  }

  /** @inheritdoc */
  public async generateQuestions(examId: string): Promise<void> {
    this.logger.log(`[${this.rid}] generateQuestions — start | examId: ${examId}`);
    const exam = await this.uow.consultantSkillExams.findById(examId);
    if (!exam || exam.status !== SkillExamStatus.GENERATING_QUESTIONS) {
      this.logger.warn(
        `[${this.rid}] generateQuestions — wrong state | examId: ${examId} | status: ${exam?.status ?? 'missing'}`,
      );
      return;
    }
    const skill = await this.uow.skills.findById(exam.skillId);
    if (!skill) {
      this.logger.error(`[${this.rid}] generateQuestions — skill missing | examId: ${examId}`);
      return;
    }

    const systemPrompt =
      `You are a senior technical interviewer. Produce exactly ${TOTAL_SKILL_EXAM_QUESTIONS} diverse, ` +
      `non-trivial interview questions for the skill below. Return STRICT JSON: ` +
      `{"questions":[{"question_order":1,"content":"..."},...]} with question_order 1..${TOTAL_SKILL_EXAM_QUESTIONS}.`;
    const userPrompt = `Skill key (i18n): ${skill.name}\nCategory key: ${skill.category ?? 'general'}`;

    let parsed: { questions: IAiGeneratedQuestion[] } | null = null;
    try {
      const raw = await this.serverAi.complete(AiAssistantType.INTERVIEW, systemPrompt, userPrompt);
      parsed = JSON.parse(this.extractJson(raw)) as { questions: IAiGeneratedQuestion[] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[${this.rid}] generateQuestions — AI call failed | error: ${msg}`);
      return;
    }
    if (!parsed?.questions || parsed.questions.length < TOTAL_SKILL_EXAM_QUESTIONS) {
      this.logger.error(
        `[${this.rid}] generateQuestions — bad AI response | got: ${parsed?.questions?.length ?? 0}`,
      );
      return;
    }

    const ordered = parsed.questions
      .slice(0, TOTAL_SKILL_EXAM_QUESTIONS)
      .sort((a, b) => a.question_order - b.question_order);

    await this.uow.withTransaction(async (tx) => {
      const rows = ordered.map((q, idx) =>
        tx.consultantSkillExamQuestions.create({
          examId,
          questionOrder: idx + 1,
          content: q.content,
        }),
      );
      await tx.consultantSkillExamQuestions.save(rows);
      exam.status = SkillExamStatus.IN_PROGRESS;
      exam.startedAt = new Date();
      await tx.consultantSkillExams.save(exam);
    });

    this.logger.log(`[${this.rid}] generateQuestions — complete | examId: ${examId}`);
  }

  /** @inheritdoc */
  public async run(examId: string): Promise<void> {
    this.logger.log(`[${this.rid}] run — start | examId: ${examId}`);
    const exam = await this.uow.consultantSkillExams.findById(examId);
    if (!exam || exam.status !== SkillExamStatus.RUNNING_AI_EVAL) {
      this.logger.warn(
        `[${this.rid}] run — wrong state | examId: ${examId} | status: ${exam?.status ?? 'missing'}`,
      );
      return;
    }

    const [questions, answers, skill] = await Promise.all([
      this.uow.consultantSkillExamQuestions.findByExamId(examId),
      this.uow.consultantSkillExamAnswers.findByExamId(examId),
      this.uow.skills.findById(exam.skillId),
    ]);
    if (!skill) return;

    const answerByQuestion = new Map(answers.map((a) => [a.examQuestionId, a]));
    const qaPairs = questions.map((q) => ({
      order: q.questionOrder,
      question: q.content,
      answer: answerByQuestion.get(q.id)?.answerText ?? '',
    }));

    const systemPrompt =
      `You grade ${TOTAL_SKILL_EXAM_QUESTIONS} answers to skill-specific interview questions. ` +
      `Return STRICT JSON: {"overall_score":<0-100>,"correct_count":<int>,"answers":[{"order":1,"score":<0-100>,"is_correct":<bool>,"feedback":"..."},...]}. ` +
      `An answer is correct when score >= ${ANSWER_CORRECTNESS_THRESHOLD}.`;
    const userPrompt = `Skill: ${skill.name}\n\n${qaPairs
      .map((p) => `Q${p.order}: ${p.question}\nA${p.order}: ${p.answer}`)
      .join('\n\n')}`;

    let parsed: IAiEvalResult | null = null;
    try {
      const raw = await this.serverAi.complete(
        AiAssistantType.EVALUATE_ANSWER,
        systemPrompt,
        userPrompt,
      );
      parsed = JSON.parse(this.extractJson(raw)) as IAiEvalResult;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[${this.rid}] run — AI call failed | error: ${msg}`);
      return;
    }
    if (!parsed?.answers) {
      this.logger.error(`[${this.rid}] run — bad AI response | examId: ${examId}`);
      return;
    }

    const overallScore = clamp(parsed.overall_score, 0, 100);
    const correctCount =
      typeof parsed.correct_count === 'number'
        ? parsed.correct_count
        : parsed.answers.filter((a) => a.is_correct ?? a.score >= ANSWER_CORRECTNESS_THRESHOLD)
            .length;

    // Persist per-answer scores.
    const aResultsByOrder = new Map(parsed.answers.map((a) => [a.order, a]));
    for (const q of questions) {
      const answer = answerByQuestion.get(q.id);
      if (!answer) continue;
      const a = aResultsByOrder.get(q.questionOrder);
      if (!a) continue;
      answer.aiEvalScore = clamp(a.score, 0, 100).toFixed(2);
      answer.isCorrect = a.is_correct ?? a.score >= ANSWER_CORRECTNESS_THRESHOLD;
      answer.aiFeedback = a.feedback ?? null;
      await this.uow.consultantSkillExamAnswers.save(answer);
    }

    const passed = overallScore >= PASS_THRESHOLD;

    const txResult = await this.uow.withTransaction(async (tx) => {
      const cooldownUntil = new Date();
      cooldownUntil.setDate(cooldownUntil.getDate() + COOLDOWN_DAYS);

      exam.aiEvalScore = overallScore.toFixed(2);
      exam.aiEvalCompletedAt = new Date();
      exam.correctCount = correctCount;
      exam.concludedAt = new Date();

      const profile = await tx.consultantProfiles.findById(exam.consultantId);
      if (!profile) return null;

      if (!passed) {
        exam.status = SkillExamStatus.FAILED;
        exam.failReason = SkillExamFailReason.LOW_SCORE;
        exam.cooldownUntil = cooldownUntil;
        await tx.consultantSkillExams.save(exam);
        return {
          passed: false as const,
          consultantUserId: profile.userId,
          cooldownUntilIso: cooldownUntil.toISOString(),
        };
      }

      // PASSED — assign proficiency, upsert ConsultantSkill + ConsultantSkillScore,
      // recompute avgRating, flip hasNotificationPriority on expert.
      const proficiency =
        overallScore >= EXPERT_THRESHOLD ? ProficiencyLevel.EXPERT : ProficiencyLevel.ADVANCED;
      exam.assignedProficiency = proficiency;
      exam.status = SkillExamStatus.PASSED;
      await tx.consultantSkillExams.save(exam);

      const existingLink = await tx.consultantSkills.findOne({
        where: { consultantId: profile.id, skillId: exam.skillId },
      });
      const ratingStr = overallScore.toFixed(2);
      if (existingLink) {
        existingLink.proficiencyLevel = proficiency;
        existingLink.rating = ratingStr;
        await tx.consultantSkills.save(existingLink);
      } else {
        const link = tx.consultantSkills.create({
          consultantId: profile.id,
          skillId: exam.skillId,
          proficiencyLevel: proficiency,
          rating: ratingStr,
        }) as ConsultantSkill;
        await tx.consultantSkills.save(link);
      }

      const scoreRow = tx.consultantSkillScores.create({
        consultantId: profile.id,
        skillId: exam.skillId,
        examId: exam.id,
        score: ratingStr,
        calculatedAt: new Date(),
      }) as ConsultantSkillScore;
      await tx.consultantSkillScores.save(scoreRow);

      // Recompute avg rating from all current ConsultantSkill rows for this consultant.
      const allLinks = await tx.consultantSkills.findBy({ consultantId: profile.id });
      const ratings = allLinks
        .map((l) => (l.rating ? parseFloat(l.rating) : null))
        .filter((v): v is number => v !== null);
      const newAvg =
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      profile.avgRating = newAvg !== null ? newAvg.toFixed(2) : null;
      if (proficiency === ProficiencyLevel.EXPERT) {
        profile.hasNotificationPriority = true;
      }
      await tx.consultantProfiles.save(profile);

      return {
        passed: true as const,
        consultantUserId: profile.userId,
        proficiency,
        cooldownUntilIso: cooldownUntil.toISOString(),
      };
    });

    if (!txResult) {
      this.logger.error(`[${this.rid}] run — profile missing | examId: ${examId}`);
      return;
    }

    if (txResult.passed) {
      const payload: IConsultantSkillExamPassedEvent = {
        consultant_user_id: txResult.consultantUserId,
        exam_id: examId,
        skill_id: exam.skillId,
        skill_name: skill.name,
        final_score: overallScore,
        proficiency_level: txResult.proficiency === ProficiencyLevel.EXPERT ? 'expert' : 'advanced',
      };
      this.eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_PASSED, payload);
    } else {
      const user = await this.uow.users.findById(txResult.consultantUserId);
      const payload: IConsultantSkillExamFailedEvent = {
        consultant_user_id: txResult.consultantUserId,
        exam_id: examId,
        skill_id: exam.skillId,
        skill_name: skill.name,
        fail_reason: 'LOW_SCORE',
        final_score: overallScore,
        cooldown_until: txResult.cooldownUntilIso,
        strike_count: user?.aiStrikeCount ?? 0,
      };
      this.eventEmitter.emit(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_FAILED, payload);
    }

    this.logger.log(
      `[${this.rid}] run — complete | examId: ${examId} | passed: ${txResult.passed} | score: ${overallScore}`,
    );
  }

  /** Trims any leading/trailing fences and prose so JSON.parse can chew the body. */
  private extractJson(raw: string): string {
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) return fenceMatch[1].trim();
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) return raw.slice(firstBrace, lastBrace + 1);
    return raw;
  }
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
