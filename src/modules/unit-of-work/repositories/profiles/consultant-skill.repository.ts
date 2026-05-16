import { AbstractRepository } from '@common/repositories';
import { ConsultantSkill } from '@database/entities';
import { ProficiencyLevel } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
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
}
