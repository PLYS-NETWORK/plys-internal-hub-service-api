import { Injectable } from '@nestjs/common';
import {
  IConsultantSkillExamFailedEvent,
  IConsultantSkillExamPassedEvent,
  NOTIFICATION_EVENTS,
} from '@plys/libraries/common-nest/events';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { NotificationsClientService } from '@plys/libraries/common-nest/modules/notifications-client/notifications-client.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ServerAiService } from '@plys/libraries/common-nest/modules/server-ai/server-ai.service';
import { ConsultantSkill, ConsultantSkillScore } from '@plys/libraries/database/entities';
import {
  AiAssistantType,
  ProficiencyLevel,
  SkillExamFailReason,
  SkillExamStatus,
} from '@plys/libraries/database/enums';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';

import {
  ANSWER_CORRECTNESS_THRESHOLD,
  AVG_RATING_PRIORITY_THRESHOLD,
  BEGINNER_MAX,
  EXAM_DURATION_MIN,
  EXPERT_THRESHOLD,
  INTERMEDIATE_MAX,
  LOW_SCORE_COOLDOWN_DAYS,
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
    private readonly uow: ProfilesUnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly serverAi: ServerAiService,
    private readonly notificationsClient: NotificationsClientService,
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

    // Prompt is intentionally domain-agnostic — skills can come from any field,
    // not just technical ones (design, finance, language, etc.). The AI must
    // produce 20 questions appropriate for the named skill regardless.
    const systemPrompt =
      `You are a senior interviewer. Produce exactly ${TOTAL_SKILL_EXAM_QUESTIONS} diverse, ` +
      `non-trivial interview questions for the skill below — adapt the content to the skill's field ` +
      `(technical, creative, business, language, etc.). Return STRICT JSON: ` +
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

      // Timer starts the moment the consultant has questions in hand.
      const now = new Date();
      const expiresAt = new Date(now.getTime() + EXAM_DURATION_MIN * 60_000);
      exam.status = SkillExamStatus.IN_PROGRESS;
      exam.startedAt = now;
      exam.expiresAt = expiresAt;
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

    // 4-tier proficiency band — assigned on every result, not just on pass.
    //   < BEGINNER_MAX (40)     → BEGINNER     (fail, 30d cooldown)
    //   < INTERMEDIATE_MAX (80) → INTERMEDIATE (fail, 30d cooldown)
    //   < EXPERT_THRESHOLD (90) → SENIOR       (pass)
    //   >= EXPERT_THRESHOLD     → EXPERT       (pass)
    const proficiency = this.scoreToProficiency(overallScore);
    const passed = overallScore >= INTERMEDIATE_MAX;

    const txResult = await this.uow.withTransaction(async (tx) => {
      exam.aiEvalScore = overallScore.toFixed(2);
      exam.aiEvalCompletedAt = new Date();
      exam.correctCount = correctCount;
      exam.concludedAt = new Date();
      exam.assignedProficiency = proficiency;

      const profile = await tx.consultantProfiles.findById(exam.consultantId);
      if (!profile) return null;

      if (!passed) {
        const cooldownUntil = new Date();
        cooldownUntil.setDate(cooldownUntil.getDate() + LOW_SCORE_COOLDOWN_DAYS);

        exam.status = SkillExamStatus.FAILED;
        exam.failReason = SkillExamFailReason.LOW_SCORE;
        exam.cooldownUntil = cooldownUntil;
        await tx.consultantSkillExams.save(exam);
        return {
          passed: false as const,
          consultantUserId: profile.userId,
          proficiency,
          cooldownUntilIso: cooldownUntil.toISOString(),
        };
      }

      exam.status = SkillExamStatus.PASSED;
      exam.cooldownUntil = null;
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

      // Recompute avgRating across every ConsultantSkill row, then key
      // hasNotificationPriority off avgRating (not the individual exam).
      const allLinks = await tx.consultantSkills.findBy({ consultantId: profile.id });
      const ratings = allLinks
        .map((l) => (l.rating ? parseFloat(l.rating) : null))
        .filter((v): v is number => v !== null);
      const newAvg =
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      profile.avgRating = newAvg !== null ? newAvg.toFixed(2) : null;
      profile.hasNotificationPriority = newAvg !== null && newAvg >= AVG_RATING_PRIORITY_THRESHOLD;
      await tx.consultantProfiles.save(profile);

      // A pass proves the consultant can finish an exam — reset the platform-wide
      // expired-attempt counter so the 2-day pause doesn't linger.
      const user = await tx.users.findById(profile.userId);
      if (user && (user.examExpiredCount > 0 || user.examTakingBlockedUntil)) {
        user.examExpiredCount = 0;
        user.examTakingBlockedUntil = null;
        await tx.users.save(user);
      }

      return {
        passed: true as const,
        consultantUserId: profile.userId,
        proficiency,
        cooldownUntilIso: null,
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
        proficiency_level: txResult.proficiency === ProficiencyLevel.EXPERT ? 'expert' : 'senior',
      };
      this.notificationsClient.emit(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_PASSED, payload);
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
        assigned_proficiency:
          txResult.proficiency === ProficiencyLevel.BEGINNER ? 'beginner' : 'intermediate',
      };
      this.notificationsClient.emit(NOTIFICATION_EVENTS.CONSULTANT_SKILL_EXAM_FAILED, payload);
    }

    this.logger.log(
      `[${this.rid}] run — complete | examId: ${examId} | passed: ${txResult.passed} | proficiency: ${txResult.proficiency} | score: ${overallScore}`,
    );
  }

  // Score band → proficiency. Boundaries: < 40 BEGINNER, < 80 INTERMEDIATE,
  // < 90 SENIOR, >= 90 EXPERT. Kept as a pure function so admin/tests can reuse.
  private scoreToProficiency(score: number): ProficiencyLevel {
    if (score < BEGINNER_MAX) return ProficiencyLevel.BEGINNER;
    if (score < INTERMEDIATE_MAX) return ProficiencyLevel.INTERMEDIATE;
    if (score < EXPERT_THRESHOLD) return ProficiencyLevel.SENIOR;
    return ProficiencyLevel.EXPERT;
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
