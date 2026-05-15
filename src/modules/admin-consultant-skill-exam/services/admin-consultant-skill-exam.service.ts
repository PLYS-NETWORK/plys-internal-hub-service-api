import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { ConsultantSkillExam } from '@database/entities';
import { SkillExamStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ListSkillExamsDto } from '../dto/requests/list-skill-exams.dto';
import { AdminSkillExamDetailResponseDto } from '../dto/responses/skill-exam-detail-response.dto';
import {
  AdminPaginatedSkillExamsResponseDto,
  AdminSkillExamListItemResponseDto,
  AdminSkillExamPaginationMetaDto,
} from '../dto/responses/skill-exam-list-item-response.dto';
import { IAdminConsultantSkillExamService } from '../interfaces/admin-consultant-skill-exam.service.interface';

@Injectable()
export class AdminConsultantSkillExamService implements IAdminConsultantSkillExamService {
  private readonly logger: AppLogger;

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(AdminConsultantSkillExamService.name, requestContext);
  }

  /** @inheritdoc */
  public async list(dto: ListSkillExamsDto): Promise<AdminPaginatedSkillExamsResponseDto> {
    const page = dto.page ?? 1;
    const take = dto.take ?? 20;
    this.logger.log(
      `[${this.rid}] list — start | status: ${dto.status ?? 'any'} | consultantId: ${dto.consultantId ?? 'any'} | skillId: ${dto.skillId ?? 'any'} | page: ${page}`,
    );

    const where: { status?: SkillExamStatus; consultantId?: string; skillId?: string } = {};
    if (dto.status) where.status = dto.status as SkillExamStatus;
    if (dto.consultantId) where.consultantId = dto.consultantId;
    if (dto.skillId) where.skillId = dto.skillId;

    const [rows, total] = await this.uow.consultantSkillExams.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * take,
      take,
    });

    // Hydrate consultants + skills in a single batch each (N+1-safe).
    const profileIds = Array.from(new Set(rows.map((r) => r.consultantId)));
    const skillIds = Array.from(new Set(rows.map((r) => r.skillId)));
    const [profiles, skills] = await Promise.all([
      Promise.all(profileIds.map((id) => this.uow.consultantProfiles.findById(id))),
      Promise.all(skillIds.map((id) => this.uow.skills.findById(id))),
    ]);
    const profileById = new Map(profiles.filter(Boolean).map((p) => [p!.id, p!]));
    const skillById = new Map(skills.filter(Boolean).map((s) => [s!.id, s!]));

    const userIds = Array.from(
      new Set(profileIds.map((id) => profileById.get(id)?.userId).filter(Boolean) as string[]),
    );
    const users = await Promise.all(userIds.map((id) => this.uow.users.findById(id)));
    const userById = new Map(users.filter(Boolean).map((u) => [u!.id, u!]));

    const tz = this.tz();
    const data = rows.map((row) => this.toListItem(row, profileById, skillById, userById, tz));

    const pageCount = Math.max(1, Math.ceil(total / take));
    const meta = plainToInstance(
      AdminSkillExamPaginationMetaDto,
      {
        page,
        take,
        item_count: total,
        page_count: pageCount,
        has_previous_page: page > 1,
        has_next_page: page < pageCount,
      },
      { excludeExtraneousValues: true },
    );

    return plainToInstance(
      AdminPaginatedSkillExamsResponseDto,
      { data, meta },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getDetail(examId: string): Promise<AdminSkillExamDetailResponseDto> {
    this.logger.log(`[${this.rid}] getDetail — start | examId: ${examId}`);
    const exam = await this.uow.consultantSkillExams.findById(examId);
    if (!exam) {
      throw new TranslatableException({
        messageKey: 'error.skill_exam.not_found',
        errorCode: ERROR_CODES.SKILL_EXAM_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const [profile, skill, questions, answers] = await Promise.all([
      this.uow.consultantProfiles.findById(exam.consultantId),
      this.uow.skills.findById(exam.skillId),
      this.uow.consultantSkillExamQuestions.findByExamId(examId),
      this.uow.consultantSkillExamAnswers.findByExamId(examId),
    ]);
    const user = profile ? await this.uow.users.findById(profile.userId) : null;
    const answerByQuestion = new Map(answers.map((a) => [a.examQuestionId, a]));
    const tz = this.tz();

    const questionViews = questions.map((q) => {
      const a = answerByQuestion.get(q.id);
      return {
        id: q.id,
        question_order: q.questionOrder,
        content: q.content,
        answer_text: a?.answerText ?? null,
        ai_eval_score: a?.aiEvalScore ?? null,
        copyleaks_ai_score: a?.copyleaksAiScore ?? null,
        is_correct: a?.isCorrect ?? null,
        ai_feedback: a?.aiFeedback ?? null,
      };
    });

    return plainToInstance(
      AdminSkillExamDetailResponseDto,
      {
        id: exam.id,
        consultant_user_id: profile?.userId ?? '',
        consultant_full_name: profile?.fullName ?? '',
        consultant_email: user?.email ?? '',
        bio: profile?.bio ?? null,
        skill_id: exam.skillId,
        skill_name: skill?.name ?? '',
        status: exam.status,
        assigned_proficiency: exam.assignedProficiency,
        ai_eval_score: exam.aiEvalScore,
        attempt_number: exam.attemptNumber,
        fail_reason: exam.failReason,
        correct_count: exam.correctCount,
        copyleaks_aggregate_score: exam.copyleaksAggregateScore,
        cooldown_until: DateUtil.toZonedIso(exam.cooldownUntil, tz),
        started_at: DateUtil.toZonedIso(exam.startedAt, tz),
        expires_at: DateUtil.toZonedIso(exam.expiresAt, tz),
        submitted_at: DateUtil.toZonedIso(exam.submittedAt, tz),
        concluded_at: DateUtil.toZonedIso(exam.concludedAt, tz),
        created_at: DateUtil.toZonedIso(exam.createdAt, tz) ?? exam.createdAt.toISOString(),
        questions: questionViews,
      },
      { excludeExtraneousValues: true },
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private tz(): string {
    return this.requestContext.timezone ?? 'UTC';
  }

  private toListItem(
    row: ConsultantSkillExam,
    profileById: Map<string, { userId: string; fullName: string }>,
    skillById: Map<string, { name: string }>,
    userById: Map<string, { email: string }>,
    tz: string,
  ): AdminSkillExamListItemResponseDto {
    const profile = profileById.get(row.consultantId);
    const skill = skillById.get(row.skillId);
    const user = profile ? userById.get(profile.userId) : undefined;
    void user; // email is only surfaced on detail; reserved here.
    return plainToInstance(
      AdminSkillExamListItemResponseDto,
      {
        id: row.id,
        consultant_user_id: profile?.userId ?? '',
        consultant_full_name: profile?.fullName ?? '',
        skill_id: row.skillId,
        skill_name: skill?.name ?? '',
        status: row.status,
        assigned_proficiency: row.assignedProficiency,
        ai_eval_score: row.aiEvalScore,
        attempt_number: row.attemptNumber,
        fail_reason: row.failReason,
        submitted_at: DateUtil.toZonedIso(row.submittedAt, tz),
        concluded_at: DateUtil.toZonedIso(row.concludedAt, tz),
        created_at: DateUtil.toZonedIso(row.createdAt, tz) ?? row.createdAt.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }
}
