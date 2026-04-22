import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import {
  BusinessProfile,
  Project,
  ProjectInterviewQuestion,
  ProjectRequiredSkill,
} from '@database/entities';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';
import { In } from 'typeorm';

import { ConsultantProjectResponseDto } from '../dto/responses';
import { IConsultantProjectService } from '../interfaces/consultant-project-service.interface';

@Injectable()
export class ConsultantProjectService implements IConsultantProjectService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly i18n: I18nService,
  ) {
    this.logger = new AppLogger(ConsultantProjectService.name, requestContext);
  }

  // Returns paginated public projects that require at least one skill the
  // calling consultant possesses. Projects with no skill overlap are excluded.
  /** @inheritdoc */
  public async findMatchingProjects(
    pageOptions: PageOptionsDto,
  ): Promise<PageDto<ConsultantProjectResponseDto>> {
    const consultantId = await this.resolveConsultantId();
    this.logger.log(
      `findMatchingProjects — start | consultantId: ${consultantId}, page: ${pageOptions.page}`,
    );

    // Fetch consultant's skills once — all subsequent filtering is done in DB.
    const consultantSkills = await this.uow.consultantSkills.findByConsultantId(consultantId);
    const skillIds = consultantSkills.map((cs) => cs.skillId);

    if (skillIds.length === 0) {
      this.logger.warn(
        `findMatchingProjects — consultant has no skills | consultantId: ${consultantId}`,
      );
      return new PageDto([], new PageMetaDto({ pageOptionsDto: pageOptions, itemCount: 0 }));
    }

    const [projects, itemCount] = await this.uow.projects.findPublicMatchingSkills(
      skillIds,
      pageOptions.skip,
      pageOptions.limit,
    );

    const projectIds = projects.map((p) => p.id);
    const businessIds = [...new Set(projects.map((p) => p.businessId))];

    const [skills, questions, businessProfiles] = await Promise.all([
      this.loadSkillsForProjects(projectIds),
      this.loadQuestionsForProjects(projectIds),
      this.loadBusinessProfiles(businessIds),
    ]);

    const data = projects.map((p) =>
      this.toResponseDto(
        p,
        skills.get(p.id) ?? [],
        questions.get(p.id) ?? [],
        businessProfiles.get(p.businessId),
      ),
    );
    const meta = new PageMetaDto({ pageOptionsDto: pageOptions, itemCount });

    this.logger.log(
      `findMatchingProjects — complete | consultantId: ${consultantId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async resolveConsultantId(): Promise<string> {
    const userId = this.requestContext.userId!;
    const profile = await this.uow.consultantProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(`resolveConsultantId — consultant profile not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }

    return profile.id;
  }

  private async loadSkillsForProjects(
    projectIds: string[],
  ): Promise<Map<string, ProjectRequiredSkill[]>> {
    if (projectIds.length === 0) return new Map();

    const allSkills = await this.uow.projectRequiredSkills.find({
      where: projectIds.map((id) => ({ projectId: id })),
      relations: { skill: true },
    });

    const byProject = new Map<string, ProjectRequiredSkill[]>();
    for (const skill of allSkills) {
      const list = byProject.get(skill.projectId) ?? [];
      list.push(skill);
      byProject.set(skill.projectId, list);
    }
    return byProject;
  }

  private async loadQuestionsForProjects(
    projectIds: string[],
  ): Promise<Map<string, ProjectInterviewQuestion[]>> {
    if (projectIds.length === 0) return new Map();

    const allQuestions = await this.uow.projectInterviewQuestions.find({
      where: projectIds.map((id) => ({ projectId: id })),
      order: { displayOrder: 'ASC' },
    });

    const byProject = new Map<string, ProjectInterviewQuestion[]>();
    for (const question of allQuestions) {
      const list = byProject.get(question.projectId) ?? [];
      list.push(question);
      byProject.set(question.projectId, list);
    }
    return byProject;
  }

  // Batch-loads business profiles by IDs (avoids N+1 when multiple projects
  // share the same business or each project has a different owner).
  private async loadBusinessProfiles(businessIds: string[]): Promise<Map<string, BusinessProfile>> {
    if (businessIds.length === 0) return new Map();

    const profiles = await this.uow.businessProfiles.find({
      where: { id: In(businessIds) },
    });

    const byId = new Map<string, BusinessProfile>();
    for (const profile of profiles) {
      byId.set(profile.id, profile);
    }
    return byId;
  }

  private toResponseDto(
    project: Project,
    skills: ProjectRequiredSkill[],
    questions: ProjectInterviewQuestion[],
    businessProfile?: BusinessProfile,
  ): ConsultantProjectResponseDto {
    const lang = this.requestContext.lang;

    return plainToInstance(
      ConsultantProjectResponseDto,
      {
        id: project.id,
        businessId: project.businessId,
        title: project.title,
        introduction: project.introduction,
        status: project.status,
        requiredConsultants: project.requiredConsultants,
        publishedAt: project.publishedAt,
        startedAt: project.startedAt,
        cancelledAt: project.cancelledAt,
        payment_type: businessProfile?.allowPaymentCredit ? 'monthly' : 'per_task',
        company_name: businessProfile?.companyName ?? '',
        company_address: {
          address_line: businessProfile?.addressLine ?? null,
          city: businessProfile?.city ?? null,
          state_province: businessProfile?.stateProvince ?? null,
          postal_code: businessProfile?.postalCode ?? null,
          country_code: businessProfile?.countryCode ?? null,
        },
        is_partner_platform: businessProfile?.isPartnerPlatform ?? false,
        skills: skills.map((s) => ({
          skill_id: s.skillId,
          skill_name: this.translateSkillKey(s.skill.name, lang),
        })),
        interview_questions: questions.map((q) => ({
          id: q.id,
          question_text: q.questionText,
          display_order: q.displayOrder,
          is_required: q.isRequired,
        })),
      },
      { excludeExtraneousValues: true },
    );
  }

  private translateSkillKey(skillName: string, lang: string): string {
    try {
      const result = this.i18n.translate(`skill.${skillName}`, { lang }) as string;
      return result ?? skillName;
    } catch {
      return skillName;
    }
  }
}
