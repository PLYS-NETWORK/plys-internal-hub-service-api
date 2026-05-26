import { Inject, Injectable } from '@nestjs/common';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PageMetaDto } from '@plys/libraries/common-nest/dto/page-meta.dto';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { Project, ProjectRequiredSkill, Skill } from '@plys/libraries/database/entities';
import {
  ProjectMemberStatus,
  ProjectPaymentType,
  ProjectStatus,
} from '@plys/libraries/database/enums';
import {
  IBusinessProfileSnapshot,
  IProfilesReader,
  PROFILES_READER,
} from '@plys/libraries/profiles-port';
import { ProjectsUnitOfWorkService } from '@plys/libraries/unit-of-work/projects-unit-of-work.service';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';

import { ListConsultantExploreProjectsDto } from '../dto/requests/list-consultant-explore-projects.dto';
import {
  ConsultantExploreProjectDetailResponseDto,
  ConsultantExploreProjectListItemResponseDto,
  ConsultantExploreSkillResponseDto,
} from '../dto/responses';
import { IConsultantExploreService } from '../interfaces/consultant-explore.service.interface';
import { ConsultantAccessService } from './consultant-access.service';

// Short TTLs so newly-published or status-changed projects appear within
// ~1–2 minutes without explicit invalidation. Mirrors the Explore module.
const CACHE_TTL = { list: 60, detail: 120 } as const;

const CACHE_KEY = {
  list: (consultantId: string, lang: string, dto: ListConsultantExploreProjectsDto): string => {
    const titlePart = (dto.title ?? '').trim().toLowerCase();
    const statusPart = dto.status ?? '';
    return `consultant_explore:list:${consultantId}:${lang}:${dto.page}:${dto.limit}:${statusPart}:${titlePart}`;
  },
  detail: (consultantId: string, lang: string, id: string): string =>
    `consultant_explore:detail:${consultantId}:${lang}:${id}`,
} as const;

// Provisional cap until consultant_profiles gains an explicit capacity column.
// Gates the `is_available_to_apply` flag on the discovery feed.
const MAX_CONCURRENT_PROJECTS = 5;

@Injectable()
export class ConsultantExploreService implements IConsultantExploreService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: ProjectsUnitOfWorkService,
    @Inject(PROFILES_READER) private readonly profilesReader: IProfilesReader,
    private readonly requestContext: RequestContextService,
    private readonly redis: RedisService,
    private readonly i18n: I18nService,
    private readonly access: ConsultantAccessService,
  ) {
    this.logger = new AppLogger(ConsultantExploreService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async list(
    dto: ListConsultantExploreProjectsDto,
  ): Promise<PageDto<ConsultantExploreProjectListItemResponseDto>> {
    const consultantProfile = await this.access.resolveConsultantProfile();
    const consultantId = consultantProfile.id;
    const lang = this.requestContext.lang;
    this.logger.log(
      `[${this.rid}] list — start | consultantId: ${consultantId}, page: ${dto.page}, limit: ${dto.limit}, status: ${dto.status ?? 'any'}, title: ${dto.title ?? ''}`,
    );

    const cacheKey = CACHE_KEY.list(consultantId, lang, dto);
    const cached =
      await this.readCache<PageDto<ConsultantExploreProjectListItemResponseDto>>(cacheKey);
    if (cached) {
      this.logger.log(`[${this.rid}] list — cache hit | key: ${cacheKey}`);
      return cached;
    }

    const [projects, itemCount] = await this.uow.projects.findDiscoverableForConsultant({
      titleSearch: dto.title,
      status: dto.status,
      skip: dto.skip,
      take: dto.limit,
    });

    if (projects.length === 0) {
      const empty = new PageDto<ConsultantExploreProjectListItemResponseDto>(
        [],
        new PageMetaDto({ pageOptionsDto: dto, itemCount }),
      );
      await this.writeCache(cacheKey, empty, CACHE_TTL.list);
      this.logger.log(`[${this.rid}] list — complete | returned: 0, total: ${itemCount}`);
      return empty;
    }

    const projectIds = projects.map((p) => p.id);
    const [
      requiredCounts,
      matchedCounts,
      avgPriceMap,
      memberCounts,
      activeMembershipCount,
      joinedProjectIds,
    ] = await Promise.all([
      this.countRequiredSkillsByProject(projectIds),
      this.countMatchedSkillsByProject(projectIds, consultantId),
      this.uow.tasks.avgPriceByProjectIds(projectIds),
      this.uow.projectMembers.countActiveByProjectIds(projectIds),
      this.countActiveMemberships(consultantId),
      this.uow.projectMembers.findActiveProjectIdsByConsultantId(consultantId, projectIds),
    ]);

    const data = projects.map((project) =>
      this.toListItemDto(
        project,
        requiredCounts.get(project.id) ?? 0,
        matchedCounts.get(project.id) ?? 0,
        avgPriceMap.get(project.id) ?? null,
        memberCounts.get(project.id) ?? 0,
        activeMembershipCount,
        joinedProjectIds.has(project.id),
      ),
    );

    const page = new PageDto(data, new PageMetaDto({ pageOptionsDto: dto, itemCount }));
    await this.writeCache(cacheKey, page, CACHE_TTL.list);
    this.logger.log(
      `[${this.rid}] list — complete | returned: ${data.length}, total: ${itemCount}`,
    );
    return page;
  }

  /** @inheritdoc */
  public async getDetail(projectId: string): Promise<ConsultantExploreProjectDetailResponseDto> {
    const { project, consultantProfile } = await this.access.resolveAccessibleProject(projectId);
    const consultantId = consultantProfile.id;
    const lang = this.requestContext.lang;
    this.logger.log(
      `[${this.rid}] getDetail — start | projectId: ${projectId}, consultantId: ${consultantId}`,
    );

    const cacheKey = CACHE_KEY.detail(consultantId, lang, projectId);
    const cached = await this.readCache<ConsultantExploreProjectDetailResponseDto>(cacheKey);
    if (cached) {
      this.logger.log(`[${this.rid}] getDetail — cache hit | key: ${cacheKey}`);
      return cached;
    }

    const [
      businessProfile,
      requiredSkills,
      matchedCountsMap,
      avgPriceMap,
      totalMembers,
      activeMembershipCount,
      joinedProjectIds,
    ] = await Promise.all([
      this.profilesReader.findBusinessById(project.businessId),
      this.uow.projectRequiredSkills.findWithSkillByProjectId(projectId),
      this.countMatchedSkillsByProject([projectId], consultantId),
      this.uow.tasks.avgPriceByProjectIds([projectId]),
      this.uow.projectMembers.countActiveTotalByProjectIds([projectId]),
      this.countActiveMemberships(consultantId),
      this.uow.projectMembers.findActiveProjectIdsByConsultantId(consultantId, [projectId]),
    ]);

    const requiredCount = requiredSkills.length;
    const matchedCount = matchedCountsMap.get(projectId) ?? 0;
    const avgPrice = avgPriceMap.get(projectId) ?? null;
    const matchRate = this.computeMatchRate(requiredCount, matchedCount);
    const isAvailable = this.computeIsAvailable(
      project.status,
      totalMembers,
      project.requiredConsultants,
      activeMembershipCount,
    );
    const isJoined = joinedProjectIds.has(projectId);

    const result = this.toDetailDto(
      project,
      businessProfile,
      requiredSkills,
      matchRate,
      avgPrice,
      totalMembers,
      isAvailable,
      isJoined,
      lang,
    );

    await this.writeCache(cacheKey, result, CACHE_TTL.detail);
    this.logger.log(
      `[${this.rid}] getDetail — complete | projectId: ${projectId}, matchRate: ${matchRate}, isJoined: ${isJoined}`,
    );
    return result;
  }

  // ─── Mapping ───────────────────────────────────────────────────────────────

  private toListItemDto(
    project: Project,
    requiredCount: number,
    matchedCount: number,
    avgPrice: number | null,
    memberCount: number,
    activeMembershipCount: number,
    isJoined: boolean,
  ): ConsultantExploreProjectListItemResponseDto {
    const matchRate = this.computeMatchRate(requiredCount, matchedCount);
    const isAvailable = this.computeIsAvailable(
      project.status,
      memberCount,
      project.requiredConsultants,
      activeMembershipCount,
    );

    return plainToInstance(
      ConsultantExploreProjectListItemResponseDto,
      {
        id: project.id,
        title: project.title,
        company_name: project.business?.companyName ?? '',
        is_platform_partner: project.business?.isPartnerPlatform ?? false,
        is_joined: isJoined,
        is_available_to_apply: isAvailable,
        match_rate: matchRate,
        avg_price_per_task: project.paymentType === ProjectPaymentType.PER_MONTH ? null : avgPrice,
        payment_type: project.paymentType,
        total_members: memberCount,
        required_consultants: project.requiredConsultants,
        published_at: project.publishedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toDetailDto(
    project: Project,
    businessProfile: IBusinessProfileSnapshot | null,
    requiredSkills: ProjectRequiredSkill[],
    matchRate: number,
    avgPrice: number | null,
    totalMembers: number,
    isAvailable: boolean,
    isJoined: boolean,
    lang: string,
  ): ConsultantExploreProjectDetailResponseDto {
    return plainToInstance(
      ConsultantExploreProjectDetailResponseDto,
      {
        id: project.id,
        title: project.title,
        company_name: businessProfile?.companyName ?? '',
        is_platform_partner: businessProfile?.isPartnerPlatform ?? false,
        is_joined: isJoined,
        is_available_to_apply: isAvailable,
        match_rate: matchRate,
        avg_price_per_task: project.paymentType === ProjectPaymentType.PER_MONTH ? null : avgPrice,
        payment_type: project.paymentType,
        total_members: totalMembers,
        required_consultants: project.requiredConsultants,
        published_at: project.publishedAt,
        started_at: project.startedAt,
        completed_at: project.completedAt,
        status: project.status,
        introduction: project.introduction,
        required_skills: requiredSkills.map((prs) => this.toSkillDto(prs.skill, lang)),
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
      // nestjs-i18n returns the key itself when no translation matches —
      // keep that fallback so callers always see something printable.
      return typeof value === 'string' ? value : key;
    } catch {
      return key;
    }
  }

  // ─── Aggregations ──────────────────────────────────────────────────────────

  private computeMatchRate(requiredCount: number, matchedCount: number): number {
    if (requiredCount <= 0) return 0;
    return Math.round((matchedCount / requiredCount) * 100);
  }

  // Eligibility flag surfaced by the discovery feed. With applications removed,
  // this reflects whether the project still has slots open AND the consultant
  // has capacity — a future direct-membership mechanism gates the actual join.
  private computeIsAvailable(
    status: ProjectStatus,
    memberCount: number,
    requiredConsultants: number,
    activeMembershipCount: number,
  ): boolean {
    if (status !== ProjectStatus.PUBLISHED && status !== ProjectStatus.IN_PROGRESS) return false;
    if (memberCount >= requiredConsultants) return false;
    if (activeMembershipCount >= MAX_CONCURRENT_PROJECTS) return false;
    return true;
  }

  // For each project, count how many of its required skills the consultant
  // owns. One round-trip via a grouped INNER JOIN.
  private async countMatchedSkillsByProject(
    projectIds: string[],
    consultantId: string,
  ): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.uow.projectRequiredSkills
      .createQueryBuilder('prs')
      .innerJoin(
        'consultant_skills',
        'cs',
        'cs.skill_id = prs.skill_id AND cs.consultant_id = :consultantId',
        { consultantId },
      )
      .select('prs.project_id', 'project_id')
      .addSelect('COUNT(*)::int', 'count')
      .where('prs.project_id IN (:...projectIds)', { projectIds })
      .groupBy('prs.project_id')
      .getRawMany<{ project_id: string; count: number }>();

    const out = new Map<string, number>();
    for (const row of rows) out.set(row.project_id, Number(row.count));
    return out;
  }

  // Counts required skills per project in a single round-trip.
  private async countRequiredSkillsByProject(projectIds: string[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.uow.projectRequiredSkills
      .createQueryBuilder('prs')
      .select('prs.project_id', 'project_id')
      .addSelect('COUNT(*)::int', 'count')
      .where('prs.project_id IN (:...projectIds)', { projectIds })
      .groupBy('prs.project_id')
      .getRawMany<{ project_id: string; count: number }>();
    const out = new Map<string, number>();
    for (const row of rows) out.set(row.project_id, Number(row.count));
    return out;
  }

  // Counts the consultant's currently-active memberships across all projects —
  // used to gate `is_available_to_apply` against MAX_CONCURRENT_PROJECTS.
  private async countActiveMemberships(consultantId: string): Promise<number> {
    return this.uow.projectMembers.count({
      where: {
        consultantId,
        status: ProjectMemberStatus.ACTIVE,
      },
    });
  }

  // ─── Cache ─────────────────────────────────────────────────────────────────
  // Redis failures must never take down the endpoint: reads return null on
  // error so the caller falls through to the DB, writes log a warn and move
  // on. Same pattern as the public Explore service.

  private async readCache<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[${this.rid}] readCache — cache read failed, falling through to DB | key: ${key}, error: ${message}`,
      );
      return null;
    }
  }

  private async writeCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), ttlSeconds);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[${this.rid}] writeCache — cache write failed | key: ${key}, error: ${message}`,
      );
    }
  }
}
