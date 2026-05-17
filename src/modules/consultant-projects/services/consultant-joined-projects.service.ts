import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { BusinessProfile, Project, ProjectRequiredSkill, Skill } from '@database/entities';
import { TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';

import { ListConsultantJoinedProjectsDto } from '../dto/requests/list-consultant-joined-projects.dto';
import {
  ConsultantExploreSkillResponseDto,
  ConsultantJoinedProjectDetailResponseDto,
  ConsultantJoinedProjectListItemResponseDto,
  ConsultantWorkspaceListItemResponseDto,
} from '../dto/responses';
import { CONSULTANT_JOINED_CACHE_TTL } from '../interfaces/consultant-joined-cache.service.interface';
import { IConsultantJoinedProjectsService } from '../interfaces/consultant-joined-projects.service.interface';
import { ConsultantAccessService } from './consultant-access.service';
import { ConsultantJoinedCacheService } from './consultant-joined-cache.service';

@Injectable()
export class ConsultantJoinedProjectsService implements IConsultantJoinedProjectsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly i18n: I18nService,
    private readonly access: ConsultantAccessService,
    private readonly cache: ConsultantJoinedCacheService,
  ) {
    this.logger = new AppLogger(ConsultantJoinedProjectsService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async listWorkspaces(): Promise<ConsultantWorkspaceListItemResponseDto[]> {
    const consultantProfile = await this.access.resolveConsultantProfile();
    const consultantId = consultantProfile.id;
    this.logger.log(`[${this.rid}] listWorkspaces — start | consultantId: ${consultantId}`);

    const cacheKey = this.cache.buildWorkspaceListKey(consultantId);
    const cached = await this.cache.read<ConsultantWorkspaceListItemResponseDto[]>(cacheKey);
    if (cached) {
      this.logger.log(`[${this.rid}] listWorkspaces — cache hit | key: ${cacheKey}`);
      return cached;
    }

    const projects = await this.uow.projects.findJoinedByConsultantLightweight({
      consultantId,
    });

    const data = projects.map((p) => this.toWorkspaceDto(p));
    await this.cache.write(cacheKey, data, CONSULTANT_JOINED_CACHE_TTL.workspaceList);
    this.logger.log(`[${this.rid}] listWorkspaces — complete | returned: ${data.length}`);
    return data;
  }

  /** @inheritdoc */
  public async listJoinedProjects(
    dto: ListConsultantJoinedProjectsDto,
  ): Promise<PageDto<ConsultantJoinedProjectListItemResponseDto>> {
    const consultantProfile = await this.access.resolveConsultantProfile();
    const consultantId = consultantProfile.id;
    this.logger.log(
      `[${this.rid}] listJoinedProjects — start | consultantId: ${consultantId}, page: ${dto.page}, limit: ${dto.limit}, keyword: ${dto.keyword ?? ''}`,
    );

    const cacheKey = this.cache.buildJoinedListKey(consultantId, dto);
    const cached =
      await this.cache.read<PageDto<ConsultantJoinedProjectListItemResponseDto>>(cacheKey);
    if (cached) {
      this.logger.log(`[${this.rid}] listJoinedProjects — cache hit | key: ${cacheKey}`);
      return cached;
    }

    const [projects, itemCount] = await this.uow.projects.findJoinedByConsultantPaginated({
      consultantId,
      keyword: dto.keyword,
      skip: dto.skip,
      take: dto.limit,
    });

    if (projects.length === 0) {
      const empty = new PageDto<ConsultantJoinedProjectListItemResponseDto>(
        [],
        new PageMetaDto({ pageOptionsDto: dto, itemCount }),
      );
      await this.cache.write(cacheKey, empty, CONSULTANT_JOINED_CACHE_TTL.joinedList);
      this.logger.log(`[${this.rid}] listJoinedProjects — complete | returned: 0, total: 0`);
      return empty;
    }

    const projectIds = projects.map((p) => p.id);
    const [completionRows, completedByMeMap] = await Promise.all([
      this.uow.tasks.countCompletionByProjectIdsGroupedByProject(projectIds),
      this.uow.tasks.countCompletedByAssigneeAndProjectIds(consultantId, projectIds),
    ]);

    const completionMap = new Map<string, { total: number; completed: number }>();
    for (const row of completionRows) {
      completionMap.set(row.project_id, {
        total: row.total_tasks,
        completed: row.completed_tasks,
      });
    }

    const data = projects.map((p) => {
      const completion = completionMap.get(p.id) ?? { total: 0, completed: 0 };
      return this.toJoinedListItemDto(
        p,
        this.computeCompletionPct(completion.completed, completion.total),
        completedByMeMap.get(p.id) ?? 0,
      );
    });

    const page = new PageDto(data, new PageMetaDto({ pageOptionsDto: dto, itemCount }));
    await this.cache.write(cacheKey, page, CONSULTANT_JOINED_CACHE_TTL.joinedList);
    this.logger.log(
      `[${this.rid}] listJoinedProjects — complete | returned: ${data.length}, total: ${itemCount}`,
    );
    return page;
  }

  /** @inheritdoc */
  public async getJoinedProjectDetail(
    projectId: string,
  ): Promise<ConsultantJoinedProjectDetailResponseDto> {
    const { project, consultantProfile } = await this.access.resolveJoinedProject(projectId);
    const consultantId = consultantProfile.id;
    const lang = this.requestContext.lang;
    this.logger.log(
      `[${this.rid}] getJoinedProjectDetail — start | projectId: ${projectId}, consultantId: ${consultantId}`,
    );

    const cacheKey = this.cache.buildJoinedDetailKey(consultantId, projectId);
    const cached = await this.cache.read<ConsultantJoinedProjectDetailResponseDto>(cacheKey);
    if (cached) {
      this.logger.log(`[${this.rid}] getJoinedProjectDetail — cache hit | key: ${cacheKey}`);
      return cached;
    }

    const [businessProfile, requiredSkills, statusCounts, consultantStatusCounts, totalMembers] =
      await Promise.all([
        this.uow.businessProfiles.findOne({ where: { id: project.businessId } }),
        this.uow.projectRequiredSkills.findWithSkillByProjectId(projectId),
        this.uow.tasks.countByProjectIdsGroupedByStatus([projectId]),
        this.uow.tasks.countByAssigneeAndProjectGroupedByStatus(consultantId, projectId),
        this.uow.projectMembers.countActiveTotalByProjectIds([projectId]),
      ]);

    // total_tasks excludes DRAFT (those aren't on the board for the consultant)
    // — every other status (including CANCELLED) counts so the consultant sees
    // a stable denominator even when work is killed off.
    const totalTasks = Object.entries(statusCounts).reduce(
      (sum, [status, count]) => (status === TaskKanbanStatus.DRAFT ? sum : sum + count),
      0,
    );
    const completedTasksOverall = statusCounts[TaskKanbanStatus.DONE] ?? 0;
    const completionPct = this.computeCompletionPct(completedTasksOverall, totalTasks);
    const completedByMe = consultantStatusCounts[TaskKanbanStatus.DONE] ?? 0;
    const inProgressByMe = consultantStatusCounts[TaskKanbanStatus.IN_PROGRESS] ?? 0;

    const result = this.toJoinedDetailDto(
      project,
      businessProfile,
      requiredSkills,
      lang,
      totalMembers,
      totalTasks,
      completedTasksOverall,
      completionPct,
      completedByMe,
      inProgressByMe,
    );

    await this.cache.write(cacheKey, result, CONSULTANT_JOINED_CACHE_TTL.joinedDetail);
    this.logger.log(
      `[${this.rid}] getJoinedProjectDetail — complete | projectId: ${projectId}, completionPct: ${completionPct}, completedByMe: ${completedByMe}`,
    );
    return result;
  }

  // ─── Mapping ───────────────────────────────────────────────────────────────

  private toWorkspaceDto(project: Project): ConsultantWorkspaceListItemResponseDto {
    return plainToInstance(
      ConsultantWorkspaceListItemResponseDto,
      {
        id: project.id,
        title: project.title,
        code: project.code,
        status: project.status,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toJoinedListItemDto(
    project: Project,
    completionPct: number,
    completedTasksByMe: number,
  ): ConsultantJoinedProjectListItemResponseDto {
    return plainToInstance(
      ConsultantJoinedProjectListItemResponseDto,
      {
        id: project.id,
        title: project.title,
        code: project.code,
        status: project.status,
        started_at: project.startedAt,
        company_name: project.business?.companyName ?? '',
        completion_pct: completionPct,
        completed_tasks_by_me: completedTasksByMe,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toJoinedDetailDto(
    project: Project,
    businessProfile: BusinessProfile | null,
    requiredSkills: ProjectRequiredSkill[],
    lang: string,
    totalMembers: number,
    totalTasks: number,
    completedTasksOverall: number,
    completionPct: number,
    completedTasksByMe: number,
    inProgressByMe: number,
  ): ConsultantJoinedProjectDetailResponseDto {
    return plainToInstance(
      ConsultantJoinedProjectDetailResponseDto,
      {
        id: project.id,
        title: project.title,
        code: project.code,
        status: project.status,
        introduction: project.introduction,
        started_at: project.startedAt,
        completed_at: project.completedAt,
        company_name: businessProfile?.companyName ?? '',
        required_skills: requiredSkills.map((prs) => this.toSkillDto(prs.skill, lang)),
        total_members: totalMembers,
        total_tasks: totalTasks,
        completed_tasks_overall: completedTasksOverall,
        completion_pct: completionPct,
        completed_tasks_by_me: completedTasksByMe,
        in_progress_by_me: inProgressByMe,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toSkillDto(skill: Skill, lang: string): ConsultantExploreSkillResponseDto {
    return plainToInstance(
      ConsultantExploreSkillResponseDto,
      {
        id: skill.id,
        name: skill.name,
        label: this.translateKey(`skill.${skill.name}`, lang),
        category: skill.category,
        category_label:
          skill.category !== null ? this.translateKey(`category.${skill.category}`, lang) : null,
      },
      { excludeExtraneousValues: true },
    );
  }

  private translateKey(key: string, lang: string): string {
    try {
      const value = this.i18n.translate(key, { lang }) as unknown;
      return typeof value === 'string' ? value : key;
    } catch {
      return key;
    }
  }

  private computeCompletionPct(completed: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((completed / total) * 100);
  }
}
