import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Project, ProjectRequiredSkill } from '@database/entities';
import { ProjectStatus } from '@database/enums';
import { IUnitOfWork } from '@modules/unit-of-work/interfaces/unit-of-work.interface';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';

import {
  CreateProjectDto,
  ListProjectsDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from '../dto/requests';
import { BusinessProjectResponseDto } from '../dto/responses';
import { IBusinessProjectService } from '../interfaces';
import { ProjectRequiredSkillsService } from './project-required-skills.service';

/** Statuses where auto-derivation from setup state is allowed. */
const SETUP_STATUSES = new Set<ProjectStatus>([
  ProjectStatus.DRAFT,
  ProjectStatus.SETTING_UP,
  ProjectStatus.CONFIGURED,
]);

@Injectable()
export class BusinessProjectService implements IBusinessProjectService {
  private readonly logger = new Logger(BusinessProjectService.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly i18n: I18nService,
    private readonly projectRequiredSkillsService: ProjectRequiredSkillsService,
  ) {}

  /** @inheritdoc */
  public async createProject(dto: CreateProjectDto): Promise<BusinessProjectResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(
      `[${this.rid}] createProject — start | businessId: ${businessId}, title: ${dto.title}`,
    );

    const requiredConsultants = dto.required_consultants ?? 1;
    const status = this.deriveInitialStatus();

    const [project, skills] = await this.uow.withTransaction(async (txUow) => {
      const newProject = txUow.projects.create({
        businessId,
        title: dto.title,
        introduction: dto.introduction ?? null,
        requiredConsultants,
        status,
      });
      const savedProject = await txUow.projects.save(newProject);
      const savedSkills = await this.projectRequiredSkillsService.createForProject(
        savedProject.id,
        dto.skills ?? [],
        txUow,
      );
      return [savedProject, savedSkills] as const;
    });

    this.logger.log(
      `[${this.rid}] createProject — complete | businessId: ${businessId}, projectId: ${project.id}, status: ${project.status}, skills: ${skills.length}`,
    );
    return this.toResponseDto(project, skills);
  }

  /** @inheritdoc */
  public async listMyProjects(dto: ListProjectsDto): Promise<PageDto<BusinessProjectResponseDto>> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(
      `[${this.rid}] listMyProjects — start | businessId: ${businessId}, page: ${dto.page}, keywords: ${dto.keywords ?? 'none'}`,
    );

    const [projects, itemCount] = await this.uow.projects.findByBusinessId(
      businessId,
      dto.skip,
      dto.limit,
      dto.keywords,
      dto.sort_by,
      dto.order_by,
    );

    const skills = await this.loadSkillsForProjects(projects.map((p) => p.id));

    const data = projects.map((p) => this.toResponseDto(p, skills.get(p.id) ?? []));
    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(
      `[${this.rid}] listMyProjects — complete | businessId: ${businessId}, returned: ${data.length}, total: ${itemCount}`,
    );
    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async getProject(id: string): Promise<BusinessProjectResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(`[${this.rid}] getProject — start | projectId: ${id}`);

    const project = await this.uow.projects.findByIdAndBusinessId(id, businessId);
    if (!project) {
      this.logger.warn(
        `[${this.rid}] getProject — not found or forbidden | projectId: ${id}, businessId: ${businessId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const skills = await this.projectRequiredSkillsService.findByProjectId(id);
    this.logger.log(
      `[${this.rid}] getProject — complete | projectId: ${id}, skills: ${skills.length}`,
    );
    return this.toResponseDto(project, skills);
  }

  /** @inheritdoc */
  public async updateProject(
    id: string,
    dto: UpdateProjectDto,
  ): Promise<BusinessProjectResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(`[${this.rid}] updateProject — start | projectId: ${id}`);

    const project = await this.uow.projects.findByIdAndBusinessId(id, businessId);
    if (!project) {
      this.logger.warn(
        `[${this.rid}] updateProject — not found or forbidden | projectId: ${id}, businessId: ${businessId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const [updatedProject, skills] = await this.uow.withTransaction(async (txUow) => {
      // Apply field updates to the entity in memory first.
      if (dto.title !== undefined) project.title = dto.title;
      if (dto.introduction !== undefined) project.introduction = dto.introduction;
      if (dto.required_consultants !== undefined)
        project.requiredConsultants = dto.required_consultants;

      // Resolve the post-update skill set before saving so we can derive status
      // in a single pass — avoids an extra round-trip after the save.
      const currentSkills =
        dto.skills !== undefined
          ? await this.projectRequiredSkillsService.replaceForProject(project.id, dto.skills, txUow)
          : await this.projectRequiredSkillsService.findByProjectId(project.id, txUow);

      // Auto-derive setup status only while the project is still in a
      // pre-published state. PUBLIC / IN_PROGRESS / DONE / CANCELLED are not
      // touched — their transitions are governed by the DB trigger.
      if (SETUP_STATUSES.has(project.status)) {
        project.status = await this.deriveSetupStatus(
          project.id,
          project.requiredConsultants,
          currentSkills.length,
          txUow,
        );
      }

      const savedProject = await txUow.projects.save(project);
      return [savedProject, currentSkills] as const;
    });

    this.logger.log(
      `[${this.rid}] updateProject — complete | projectId: ${updatedProject.id}, status: ${updatedProject.status}, skills: ${skills.length}`,
    );
    return this.toResponseDto(updatedProject, skills);
  }

  /** @inheritdoc */
  public async updateStatus(
    id: string,
    dto: UpdateProjectStatusDto,
  ): Promise<BusinessProjectResponseDto> {
    const businessId = await this.resolveBusinessId();
    this.logger.log(
      `[${this.rid}] updateStatus — start | projectId: ${id}, targetStatus: ${dto.status}`,
    );

    const project = await this.uow.projects.findByIdAndBusinessId(id, businessId);
    if (!project) {
      this.logger.warn(
        `[${this.rid}] updateStatus — not found or forbidden | projectId: ${id}, businessId: ${businessId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // Guard: `configured` requires at least one task. Enforce here so the
    // caller gets a clear domain error instead of a DB trigger rejection.
    if (dto.status === ProjectStatus.CONFIGURED) {
      const taskCount = await this.uow.tasks.count({ where: { projectId: id } as never });
      if (taskCount === 0) {
        this.logger.warn(
          `[${this.rid}] updateStatus — configured requires tasks | projectId: ${id}`,
        );
        throw new TranslatableException({
          messageKey: 'error.project.requires_tasks_for_configured',
          errorCode: ERROR_CODES.PROJECT_REQUIRES_TASKS_FOR_CONFIGURED,
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        });
      }
    }

    // All other transition rules are enforced by the DB trigger
    // (trg_enforce_project_status). If the transition is illegal the DB will
    // raise an exception which propagates as a DATABASE_* error. We do not
    // duplicate that logic here.
    project.status = dto.status;
    const updatedProject = await this.uow.projects.save(project);

    const skills = await this.projectRequiredSkillsService.findByProjectId(id);
    this.logger.log(
      `[${this.rid}] updateStatus — complete | projectId: ${id}, status: ${updatedProject.status}`,
    );
    return this.toResponseDto(updatedProject, skills);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async resolveBusinessId(): Promise<string> {
    const userId = this.requestContext.userId!;
    const profile = await this.uow.businessProfiles.findByUserId(userId);

    if (!profile) {
      this.logger.warn(
        `[${this.rid}] resolveBusinessId — business profile not found | userId: ${userId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }

    return profile.id;
  }

  /**
   * Derives the initial status for a newly created project.
   * Always returns `draft` — tasks cannot exist at creation time, so neither
   * `setting_up` nor `configured` are reachable.
   */
  private deriveInitialStatus(): ProjectStatus {
    return ProjectStatus.DRAFT;
  }

  /**
   * Derives the setup status for an existing project after an update.
   * Queries task count first — `configured` requires tasks to exist in addition
   * to requiredConsultants ≥ 1 and at least one skill.
   *
   * Priority order:
   * 1. `configured`  — tasks > 0 AND requiredConsultants ≥ 1 AND skills > 0
   * 2. `setting_up`  — tasks > 0
   * 3. `draft`       — none of the above
   */
  private async deriveSetupStatus(
    projectId: string,
    requiredConsultants: number,
    skillCount: number,
    uow: IUnitOfWork,
  ): Promise<ProjectStatus> {
    const taskCount = await uow.tasks.count({ where: { projectId } as never });

    if (taskCount > 0 && requiredConsultants >= 1 && skillCount > 0)
      return ProjectStatus.CONFIGURED;
    if (taskCount > 0) return ProjectStatus.SETTING_UP;

    return ProjectStatus.DRAFT;
  }

  // Loads required skills for a list of project IDs in a single query (avoids N+1).
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

  private toResponseDto(
    project: Project,
    skills: ProjectRequiredSkill[],
  ): BusinessProjectResponseDto {
    const lang = this.requestContext.lang;

    return plainToInstance(
      BusinessProjectResponseDto,
      {
        id: project.id,
        businessId: project.businessId,
        title: project.title,
        introduction: project.introduction,
        status: project.status,
        requiredConsultants: project.requiredConsultants,
        publishedAt: project.publishedAt,
        startedAt: project.startedAt,
        completedAt: project.completedAt,
        cancelledAt: project.cancelledAt,
        createdAt: project.createdAt,
        skills: skills.map((s) => ({
          skill_id: s.skillId,
          skill_name: this.translateSkillKey(s.skill.name, lang),
        })),
      },
      { excludeExtraneousValues: true },
    );
  }

  private translateSkillKey(skillName: string, lang: string): string {
    try {
      const result = this.i18n.translate(`skill.${skillName}`, { lang }) as string;
      // nestjs-i18n returns the key itself when no translation is found — use as fallback.
      return result ?? skillName;
    } catch {
      return skillName;
    }
  }
}
