import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Project, ProjectRequiredSkill, Skill } from '@database/entities';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';

import { ListExploreProjectsDto } from '../dto/requests/list-explore-projects.dto';
import {
  ExploreProjectDetailResponseDto,
  ExploreProjectListItemResponseDto,
  ExploreSkillResponseDto,
} from '../dto/responses';
import { IExploreService } from '../interfaces/explore.service.interface';

// Cache TTLs are intentionally short for project data so that newly published
// or cancelled projects appear/disappear within ~1–2 minutes without needing
// explicit invalidation from the write path. Skills are static reference data
// and tolerate a 1-hour stale window.
const CACHE_TTL = {
  skills: 3600,
  projectList: 60,
  projectDetail: 120,
} as const;

const CACHE_KEY = {
  skills: (lang: string): string => `explore:skills:${lang}`,
  projectList: (lang: string, dto: ListExploreProjectsDto): string => {
    const skillsPart = (dto.skillIds ?? []).slice().sort().join(',');
    const titlePart = (dto.title ?? '').trim().toLowerCase();
    const statusPart = dto.status ?? '';
    return `explore:projects:list:${lang}:${dto.page}:${dto.limit}:${statusPart}:${skillsPart}:${titlePart}`;
  },
  projectDetail: (lang: string, id: string): string => `explore:projects:detail:${lang}:${id}`,
};

@Injectable()
export class ExploreService implements IExploreService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly i18n: I18nService,
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ExploreService.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async listSkills(): Promise<ExploreSkillResponseDto[]> {
    const lang = this.requestContext.lang;
    const cacheKey = CACHE_KEY.skills(lang);
    this.logger.log(`[${this.rid}] listSkills — start | lang: ${lang}`);

    const cached = await this.readCache<ExploreSkillResponseDto[]>(cacheKey);
    if (cached) {
      this.logger.log(`[${this.rid}] listSkills — cache hit | key: ${cacheKey}`);
      return cached;
    }

    const skills = await this.uow.skills.find({ order: { name: 'ASC' } });
    const result = skills.map((skill) => this.toSkillDto(skill, lang));

    await this.writeCache(cacheKey, result, CACHE_TTL.skills);
    this.logger.log(`[${this.rid}] listSkills — complete | count: ${result.length}`);
    return result;
  }

  /** @inheritdoc */
  public async listProjects(
    dto: ListExploreProjectsDto,
  ): Promise<PageDto<ExploreProjectListItemResponseDto>> {
    const lang = this.requestContext.lang;
    const cacheKey = CACHE_KEY.projectList(lang, dto);
    this.logger.log(
      `[${this.rid}] listProjects — start | lang: ${lang}, page: ${dto.page}, limit: ${dto.limit}, skill_ids: ${(dto.skillIds ?? []).length}, title: ${dto.title ?? ''}, status: ${dto.status ?? 'any'}`,
    );

    const cached = await this.readCache<PageDto<ExploreProjectListItemResponseDto>>(cacheKey);
    if (cached) {
      this.logger.log(`[${this.rid}] listProjects — cache hit | key: ${cacheKey}`);
      return cached;
    }

    const [projects, itemCount] = await this.uow.projects.findExploreList({
      skillIds: dto.skillIds,
      titleSearch: dto.title,
      status: dto.status,
      skip: dto.skip,
      take: dto.limit,
    });

    // One round-trip for member counts across the whole page; the consultant
    // discovery flow uses the same `countActiveByProjectIds` helper.
    const memberCounts =
      projects.length === 0
        ? new Map<string, number>()
        : await this.uow.projectMembers.countActiveByProjectIds(projects.map((p) => p.id));

    const data = projects.map((project) =>
      this.toListItemDto(project, memberCounts.get(project.id) ?? 0),
    );
    const result = new PageDto(data, new PageMetaDto({ pageOptionsDto: dto, itemCount }));

    await this.writeCache(cacheKey, result, CACHE_TTL.projectList);
    this.logger.log(
      `[${this.rid}] listProjects — complete | returned: ${data.length}, total: ${itemCount}`,
    );
    return result;
  }

  /** @inheritdoc */
  public async getProjectDetail(id: string): Promise<ExploreProjectDetailResponseDto> {
    const lang = this.requestContext.lang;
    const cacheKey = CACHE_KEY.projectDetail(lang, id);
    this.logger.log(`[${this.rid}] getProjectDetail — start | id: ${id}, lang: ${lang}`);

    const cached = await this.readCache<ExploreProjectDetailResponseDto>(cacheKey);
    if (cached) {
      this.logger.log(`[${this.rid}] getProjectDetail — cache hit | key: ${cacheKey}`);
      return cached;
    }

    const project = await this.uow.projects.findExploreDetail(id);
    if (!project) {
      this.logger.warn(`[${this.rid}] getProjectDetail — project not found | id: ${id}`);
      throw new TranslatableException({
        messageKey: 'error.project.not_found',
        errorCode: ERROR_CODES.PROJECT_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const [requiredSkills, totalMembers] = await Promise.all([
      this.uow.projectRequiredSkills.findWithSkillByProjectId(id),
      this.uow.projectMembers.countActiveTotalByProjectIds([id]),
    ]);
    const result = this.toDetailDto(project, requiredSkills, totalMembers, lang);

    await this.writeCache(cacheKey, result, CACHE_TTL.projectDetail);
    this.logger.log(`[${this.rid}] getProjectDetail — complete | id: ${id}`);
    return result;
  }

  // ─── Mapping helpers ─────────────────────────────────────────────────────

  private toSkillDto(skill: Skill, lang: string): ExploreSkillResponseDto {
    return plainToInstance(
      ExploreSkillResponseDto,
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

  private toListItemDto(project: Project, totalMembers: number): ExploreProjectListItemResponseDto {
    return plainToInstance(
      ExploreProjectListItemResponseDto,
      {
        id: project.id,
        title: project.title,
        company_name: project.business?.companyName ?? '',
        company_logo_url: project.business?.logoUrl ?? null,
        is_partner_platform: project.business?.isPartnerPlatform ?? false,
        published_at: project.publishedAt,
        required_consultants: project.requiredConsultants,
        total_members: totalMembers,
      },
      { excludeExtraneousValues: true },
    );
  }

  private toDetailDto(
    project: Project,
    requiredSkills: ProjectRequiredSkill[],
    totalMembers: number,
    lang: string,
  ): ExploreProjectDetailResponseDto {
    return plainToInstance(
      ExploreProjectDetailResponseDto,
      {
        id: project.id,
        title: project.title,
        company_name: project.business?.companyName ?? '',
        company_logo_url: project.business?.logoUrl ?? null,
        is_partner_platform: project.business?.isPartnerPlatform ?? false,
        published_at: project.publishedAt,
        required_consultants: project.requiredConsultants,
        total_members: totalMembers,
        introduction: project.introduction,
        required_skills: requiredSkills.map((prs) => this.toSkillDto(prs.skill, lang)),
        started_at: project.startedAt,
        completed_at: project.completedAt,
        status: project.status,
      },
      { excludeExtraneousValues: true },
    );
  }

  private translateKey(key: string, lang: string): string {
    try {
      const value = this.i18n.translate(key, { lang }) as unknown;
      // nestjs-i18n returns the key itself when no translation matches — keep
      // that fallback so callers always see something printable.
      return typeof value === 'string' ? value : key;
    } catch {
      return key;
    }
  }

  // ─── Cache helpers ───────────────────────────────────────────────────────
  // Redis failures must NEVER take down a public endpoint, so reads return
  // null on error and writes are non-fatal.

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
