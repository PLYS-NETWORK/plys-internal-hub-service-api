import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ProjectInterviewQuestion, ProjectRequiredSkill } from '@database/entities';
import { ProjectStatus } from '@database/enums';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';
import { In } from 'typeorm';

import {
  UpdateInterviewQuestionDto,
  UpdateProjectSettingsDto,
  UpsertInterviewQuestionDto,
} from '../dto/requests';
import {
  InterviewQuestionResponseDto,
  ProjectSettingsResponseDto,
  ProjectSummaryResponseDto,
} from '../dto/responses';
import { ISettingsService } from '../interfaces/settings.service.interface';
import { BusinessAccessService } from './business-access.service';

const LOCKED_STATUSES = new Set<ProjectStatus>([ProjectStatus.DONE, ProjectStatus.CANCELLED]);

@Injectable()
export class SettingsService implements ISettingsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly i18n: I18nService,
  ) {
    this.logger = new AppLogger(SettingsService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async getSettings(projectId: string): Promise<ProjectSettingsResponseDto> {
    this.logger.log(`[${this.rid}] getSettings — start | projectId: ${projectId}`);
    const { project } = await this.access.resolveOwnedProject(projectId);

    const [skillRows, questions] = await Promise.all([
      this.uow.projectRequiredSkills.find({
        where: { projectId },
        relations: { skill: true },
      }),
      // Default `find` excludes soft-deleted rows because the entity uses
      // `@DeleteDateColumn` — no need to filter manually.
      this.uow.projectInterviewQuestions.find({
        where: { projectId },
        order: { displayOrder: 'ASC' },
      }),
    ]);

    const lang = this.requestContext.lang;
    const required_skills = skillRows.map((s) => ({
      id: s.skillId,
      name: this.translateSkillKey(s.skill.name, lang),
    }));
    const interview_questions = questions.map((q) => ({
      id: q.id,
      question_text: q.questionText,
      display_order: q.displayOrder,
      is_required: q.isRequired,
    }));

    this.logger.log(
      `[${this.rid}] getSettings — complete | projectId: ${projectId}, skills: ${required_skills.length}, questions: ${interview_questions.length}`,
    );

    return plainToInstance(
      ProjectSettingsResponseDto,
      {
        title: project.title,
        introduction: project.introduction,
        required_skills,
        max_consultants: project.requiredConsultants,
        interview_questions,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async updateProject(
    projectId: string,
    dto: UpdateProjectSettingsDto,
  ): Promise<ProjectSummaryResponseDto> {
    this.logger.log(`[${this.rid}] updateProject — start | projectId: ${projectId}`);
    const { project } = await this.access.resolveOwnedProject(projectId);
    this.assertProjectEditable(project.status, projectId);

    const updated = await this.uow.withTransaction(async (tx) => {
      if (dto.title !== undefined) project.title = dto.title;
      if (dto.introduction !== undefined) project.introduction = dto.introduction ?? null;
      if (dto.maxConsultants !== undefined) project.requiredConsultants = dto.maxConsultants;
      const saved = await tx.projects.save(project);

      if (dto.requiredSkills !== undefined) {
        await this.replaceRequiredSkills(tx, projectId, dto.requiredSkills);
      }

      return saved;
    });

    this.logger.log(`[${this.rid}] updateProject — complete | projectId: ${projectId}`);
    return plainToInstance(
      ProjectSummaryResponseDto,
      {
        id: updated.id,
        title: updated.title,
        introduction: updated.introduction,
        status: updated.status,
        required_consultants: updated.requiredConsultants,
        published_at: updated.publishedAt,
        created_at: updated.createdAt,
        updated_at: updated.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async createQuestion(
    projectId: string,
    dto: UpsertInterviewQuestionDto,
  ): Promise<InterviewQuestionResponseDto> {
    this.logger.log(`[${this.rid}] createQuestion — start | projectId: ${projectId}`);
    await this.access.resolveOwnedProject(projectId);

    const displayOrder = dto.displayOrder ?? (await this.nextQuestionOrder(projectId));
    const question = this.uow.projectInterviewQuestions.create({
      projectId,
      questionText: dto.questionText!,
      displayOrder,
      isRequired: dto.isRequired ?? true,
    });
    const saved = await this.uow.projectInterviewQuestions.save(question);

    this.logger.log(`[${this.rid}] createQuestion — complete | questionId: ${saved.id}`);
    return this.toQuestionResponse(saved);
  }

  /** @inheritdoc */
  public async updateQuestion(
    projectId: string,
    questionId: string,
    dto: UpdateInterviewQuestionDto,
  ): Promise<InterviewQuestionResponseDto> {
    this.logger.log(
      `[${this.rid}] updateQuestion — start | projectId: ${projectId}, questionId: ${questionId}`,
    );
    await this.access.resolveOwnedProject(projectId);

    const question = await this.findActiveQuestion(projectId, questionId);
    if (dto.questionText !== undefined) question.questionText = dto.questionText;
    if (dto.displayOrder !== undefined) question.displayOrder = dto.displayOrder;
    if (dto.isRequired !== undefined) question.isRequired = dto.isRequired;
    const saved = await this.uow.projectInterviewQuestions.save(question);

    this.logger.log(`[${this.rid}] updateQuestion — complete | questionId: ${saved.id}`);
    return this.toQuestionResponse(saved);
  }

  /** @inheritdoc */
  public async deleteQuestion(projectId: string, questionId: string): Promise<void> {
    this.logger.log(
      `[${this.rid}] deleteQuestion — start | projectId: ${projectId}, questionId: ${questionId}`,
    );
    await this.access.resolveOwnedProject(projectId);
    const question = await this.findActiveQuestion(projectId, questionId);

    // Soft delete via AuditableEntity columns. The auth user id stamps
    // deleted_by; AuditSubscriber populates timestamps automatically.
    await this.uow.projectInterviewQuestions.softDelete({ id: question.id });
    this.logger.log(`[${this.rid}] deleteQuestion — complete | questionId: ${question.id}`);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private assertProjectEditable(status: ProjectStatus, projectId: string): void {
    if (LOCKED_STATUSES.has(status)) {
      this.logger.warn(
        `[${this.rid}] assertProjectEditable — locked | projectId: ${projectId}, status: ${status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.cannot_be_edited',
        errorCode: ERROR_CODES.PROJECT_CANNOT_BE_EDITED,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }
  }

  private async replaceRequiredSkills(
    tx: IUnitOfWork,
    projectId: string,
    skillIds: string[],
  ): Promise<void> {
    if (skillIds.length > 0) {
      const found = await tx.skills.find({ where: { id: In(skillIds) }, select: { id: true } });
      if (found.length !== new Set(skillIds).size) {
        throw new TranslatableException({
          messageKey: 'error.project.skill_not_found',
          errorCode: ERROR_CODES.PROJECT_SKILL_NOT_FOUND,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }
    }

    await tx.projectRequiredSkills.delete({ projectId });
    if (skillIds.length === 0) return;

    const rows: Partial<ProjectRequiredSkill>[] = skillIds.map((skillId) => ({
      projectId,
      skillId,
    }));
    await tx.projectRequiredSkills.save(rows);
  }

  private async nextQuestionOrder(projectId: string): Promise<number> {
    const row = await this.uow.projectInterviewQuestions
      .createQueryBuilder('q')
      .select('COALESCE(MAX(q.display_order), 0)', 'max_order')
      .where('q.project_id = :projectId', { projectId })
      .andWhere('q.deleted_at IS NULL')
      .getRawOne<{ max_order: number }>();
    return Number(row?.max_order ?? 0) + 1;
  }

  private async findActiveQuestion(
    projectId: string,
    questionId: string,
  ): Promise<ProjectInterviewQuestion> {
    // Default `find` excludes rows with `deleted_at IS NOT NULL` because the
    // entity uses `@DeleteDateColumn` — no need to filter manually here.
    const question = await this.uow.projectInterviewQuestions.findOne({
      where: { id: questionId, projectId },
    });
    if (!question) {
      this.logger.warn(
        `[${this.rid}] findActiveQuestion — not found | projectId: ${projectId}, questionId: ${questionId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.interview_question_not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }
    return question;
  }

  private toQuestionResponse(q: ProjectInterviewQuestion): InterviewQuestionResponseDto {
    return plainToInstance(
      InterviewQuestionResponseDto,
      {
        id: q.id,
        question_text: q.questionText,
        display_order: q.displayOrder,
        is_required: q.isRequired,
        created_at: q.createdAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  // Skill names are i18n keys (e.g. `skill_react`); fall back to the raw key
  // so an unknown skill still renders rather than blowing up the response.
  private translateSkillKey(skillName: string, lang: string): string {
    try {
      const result = this.i18n.translate(`skill.${skillName}`, { lang }) as string;
      return result ?? skillName;
    } catch {
      return skillName;
    }
  }
}
