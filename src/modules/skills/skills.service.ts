import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Skill } from '@database/entities';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';

import { SkillResponseDto } from './dto/responses/skill-response.dto';

@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly i18n: I18nService,
    private readonly requestContext: RequestContextService,
  ) {}

  public async getAll(): Promise<SkillResponseDto[]> {
    this.logger.log(`[${this.rid}] getAll — start`);
    const skills = await this.uow.skills.find({ order: { name: 'ASC' } });
    if (skills.length === 0) {
      this.logger.warn(`[${this.rid}] getAll — result is empty`);
    }
    return skills.map((skill) => this.toResponseDto(skill));
  }

  // Build an explicit plain object so that computed fields (label, category_label)
  // are included before class-transformer maps it into SkillResponseDto.
  private toResponseDto(skill: Skill): SkillResponseDto {
    const lang = this.requestContext.lang;

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
