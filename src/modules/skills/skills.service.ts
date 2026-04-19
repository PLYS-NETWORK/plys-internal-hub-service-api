import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Skill } from '@database/entities';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { I18nService } from 'nestjs-i18n';
import { In } from 'typeorm';

import { AddSkillsDto } from './dto/requests/add-skills.dto';
import { RemoveSkillsDto } from './dto/requests/remove-skills.dto';
import { SkillResponseDto } from './dto/responses/skill-response.dto';

@Injectable()
export class SkillsService {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly i18n: I18nService,
    private readonly requestContext: RequestContextService,
  ) {}

  public async getAll(): Promise<SkillResponseDto[]> {
    const skills = await this.uow.skills.find({ order: { name: 'ASC' } });
    return skills.map((skill) => this.toResponseDto(skill));
  }

  public async addList(dto: AddSkillsDto): Promise<SkillResponseDto[]> {
    // Fetch all existing names (lowercased) to perform case-insensitive duplicate check.
    // This avoids fragmenting the taxonomy with variant-cased keys.
    const existing = await this.uow.skills.find({ select: { name: true } });
    const existingNamesLower = new Set(existing.map((s) => s.name.toLowerCase()));

    const newSkillEntities = dto.skills
      .filter((item) => !existingNamesLower.has(item.name.toLowerCase()))
      .map((item) =>
        this.uow.skills.create({
          name: item.name,
          category: item.category ?? null,
        }),
      );

    if (newSkillEntities.length === 0) {
      return [];
    }

    const saved = await this.uow.skills.save(
      newSkillEntities as Parameters<typeof this.uow.skills.save>[0],
    );

    return (saved as typeof newSkillEntities).map((skill) => this.toResponseDto(skill));
  }

  public async removeList(dto: RemoveSkillsDto): Promise<void> {
    // Soft-delete to preserve FK references in consultant_skills / project_required_skills.
    await this.uow.skills.softDelete({ id: In(dto.ids) });
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
