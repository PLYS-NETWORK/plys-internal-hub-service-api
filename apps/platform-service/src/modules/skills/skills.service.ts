import { Injectable } from '@nestjs/common';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { Skill } from '@plys/libraries/database/entities';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';

import { SkillResponseDto } from './dto/responses/skill-response.dto';

/** Cached skills list is valid for 1 hour. Skills are static reference data. */
const SKILLS_CACHE_TTL_SECONDS = 3600;

@Injectable()
export class SkillsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly i18n: I18nService,
    private readonly requestContext: RequestContextService,
    private readonly redis: RedisService,
  ) {
    this.logger = new AppLogger(SkillsService.name, requestContext);
  }

  public async getAll(): Promise<SkillResponseDto[]> {
    const lang = this.requestContext.lang;
    const cacheKey = `skills:${lang}`;

    this.logger.log(`getAll — start`);

    // Try the cache first. Redis errors are treated as a miss so the endpoint
    // stays available even when Redis is temporarily unreachable.
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        this.logger.log(`getAll — cache hit | key: ${cacheKey}`);
        return JSON.parse(cached) as SkillResponseDto[];
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`getAll — cache read failed, falling through to DB | error: ${message}`);
    }

    const skills = await this.uow.skills.find({ order: { name: 'ASC' } });
    if (skills.length === 0) {
      this.logger.warn(`getAll — result is empty`);
    }

    const result = skills.map((skill) => this.toResponseDto(skill, lang));

    // Persist to cache. Failure is non-fatal.
    try {
      await this.redis.set(cacheKey, JSON.stringify(result), SKILLS_CACHE_TTL_SECONDS);
      this.logger.log(`getAll — cached | key: ${cacheKey}, ttl: ${SKILLS_CACHE_TTL_SECONDS}s`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`getAll — cache write failed | error: ${message}`);
    }

    return result;
  }

  // Build an explicit plain object so that computed fields (label, category_label)
  // are included before class-transformer maps it into SkillResponseDto.
  private toResponseDto(skill: Skill, lang: string): SkillResponseDto {
    return plainToInstance(
      SkillResponseDto,
      {
        id: skill.id,
        name: skill.name,
        // Translate the stored i18n key (e.g. skill_react → "React").
        // Falls back to the raw key when no translation is found.
        label: this.translateKey(`skill.${skill.name}`, lang),
        category: skill.category,
        // category may be null for uncategorized skills
        category_label:
          skill.category !== null ? this.translateKey(`category.${skill.category}`, lang) : null,
        created_at: skill.createdAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  private translateKey(key: string, lang: string): string {
    try {
      const result = this.i18n.translate(key, { lang }) as string;
      // nestjs-i18n returns the key itself when not found — treat it as a fallback.
      return result ?? key;
    } catch {
      return key;
    }
  }
}
