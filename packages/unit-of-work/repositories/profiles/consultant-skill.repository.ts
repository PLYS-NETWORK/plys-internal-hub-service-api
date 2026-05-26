import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { ConsultantSkill } from '@plys/libraries/database/entities';
import { PROFICIENCY_LEVELS, ProficiencyLevel } from '@plys/libraries/database/enums';
import { EntityManager } from 'typeorm';

import { IConsultantSkillRepository, IConsultantSkillRow } from './interfaces';

@Injectable()
export class ConsultantSkillRepository
  extends AbstractRepository<ConsultantSkill>
  implements IConsultantSkillRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ConsultantSkill, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantSkillRepository(manager) as this;
  }

  public async findByConsultantId(consultantId: string): Promise<ConsultantSkill[]> {
    return this.findBy({ consultantId });
  }

  /** @inheritdoc */
  public async findByConsultantIds(consultantIds: string[]): Promise<IConsultantSkillRow[]> {
    if (consultantIds.length === 0) return [];
    return this.createQueryBuilder('cs')
      .innerJoin('cs.skill', 's')
      .select('cs.consultant_id', 'consultant_id')
      .addSelect('cs.skill_id', 'skill_id')
      .addSelect('s.name', 'skill_name')
      .addSelect('cs.proficiency_level', 'proficiency_level')
      .addSelect('cs.rating', 'rating')
      .where('cs.consultant_id IN (:...consultantIds)', { consultantIds })
      .orderBy('cs.consultant_id', 'ASC')
      .addOrderBy('s.name', 'ASC')
      .getRawMany<{
        consultant_id: string;
        skill_id: string;
        skill_name: string;
        proficiency_level: ProficiencyLevel | null;
        rating: string | null;
      }>();
  }

  /** @inheritdoc */
  public async findByConsultantIdWithSkill(consultantId: string): Promise<ConsultantSkill[]> {
    return this.createQueryBuilder('cs')
      .innerJoinAndSelect('cs.skill', 'skill')
      .where('cs.consultant_id = :consultantId', { consultantId })
      .orderBy('skill.name', 'ASC')
      .getMany();
  }

  /** @inheritdoc */
  public async countByConsultantGroupedByProficiency(
    consultantId: string,
  ): Promise<Record<ProficiencyLevel, number>> {
    const out = {} as Record<ProficiencyLevel, number>;
    for (const level of PROFICIENCY_LEVELS) out[level] = 0;

    const rows = await this.createQueryBuilder('cs')
      .select('cs.proficiency_level', 'proficiency_level')
      .addSelect('COUNT(*)', 'count')
      .where('cs.consultant_id = :consultantId', { consultantId })
      .andWhere('cs.proficiency_level IS NOT NULL')
      .groupBy('cs.proficiency_level')
      .getRawMany<{ proficiency_level: ProficiencyLevel; count: string }>();

    for (const row of rows) out[row.proficiency_level] = Number(row.count);
    return out;
  }
}
