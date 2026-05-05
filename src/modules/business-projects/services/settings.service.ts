import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ProjectRequiredSkill } from '@database/entities';
import { ProjectStatus } from '@database/enums';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';
import { In } from 'typeorm';

import { UpdateProjectSettingsDto } from '../dto/requests';
import { ProjectSettingsResponseDto, ProjectSummaryResponseDto } from '../dto/responses';
import { ISettingsService } from '../interfaces/settings.service.interface';
import { BusinessAccessService } from './business-access.service';
import { ProjectStatusService } from './projects/project-status.service';

const LOCKED_STATUSES = new Set<ProjectStatus>([ProjectStatus.DONE, ProjectStatus.CANCELLED]);

@Injectable()
export class SettingsService implements ISettingsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly i18n: I18nService,
    private readonly projectStatus: ProjectStatusService,
  ) {
    this.logger = new AppLogger(SettingsService.name, requestContext);
  }

  /** @inheritdoc */
  public async getSettings(projectId: string): Promise<ProjectSettingsResponseDto> {
    this.logger.log(`getSettings — start | projectId: ${projectId}`);
    const { project } = await this.access.resolveOwnedProject(projectId);

    const skillRows = await this.uow.projectRequiredSkills.find({
      where: { projectId },
      relations: { skill: true },
    });

    const lang = this.requestContext.lang;
    const required_skills = skillRows.map((s) => ({
      id: s.skillId,
      name: this.translateSkillKey(s.skill.name, lang),
    }));

    this.logger.log(
      `getSettings — complete | projectId: ${projectId}, skills: ${required_skills.length}`,
    );

    return plainToInstance(
      ProjectSettingsResponseDto,
      {
        title: project.title,
        introduction: project.introduction,
        required_skills,
        max_consultants: project.requiredConsultants,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async updateProject(
    projectId: string,
    dto: UpdateProjectSettingsDto,
  ): Promise<ProjectSummaryResponseDto> {
    this.logger.log(`updateProject — start | projectId: ${projectId}`);
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

      // Recompute setup-phase status from completeness signals (drafts +
      // skills + consultants). Reflect the new status on the in-memory entity
      // so the response DTO mapping below picks it up without re-reading.
      saved.status = await this.projectStatus.recomputeAutoStatus(tx, projectId);

      return saved;
    });

    this.logger.log(`updateProject — complete | projectId: ${projectId}`);
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

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private assertProjectEditable(status: ProjectStatus, projectId: string): void {
    if (LOCKED_STATUSES.has(status)) {
      this.logger.warn(
        `assertProjectEditable — locked | projectId: ${projectId}, status: ${status}`,
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
