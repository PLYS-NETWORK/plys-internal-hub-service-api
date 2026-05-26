import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { ConsultantSkillScore } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { IConsultantSkillScoreRepository } from './interfaces';

@Injectable()
export class ConsultantSkillScoreRepository
  extends AbstractRepository<ConsultantSkillScore>
  implements IConsultantSkillScoreRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ConsultantSkillScore, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantSkillScoreRepository(manager) as this;
  }

  /** @inheritdoc */
  public async findLatestPassedByConsultantGroupedBySkill(
    consultantId: string,
  ): Promise<Map<string, Date>> {
    const rows = await this.createQueryBuilder('css')
      .select('css.skill_id', 'skill_id')
      .addSelect('MAX(css.calculated_at)', 'last_calculated_at')
      .where('css.consultant_id = :consultantId', { consultantId })
      .groupBy('css.skill_id')
      .getRawMany<{ skill_id: string; last_calculated_at: Date | null }>();
    const out = new Map<string, Date>();
    for (const row of rows) {
      if (row.last_calculated_at) out.set(row.skill_id, row.last_calculated_at);
    }
    return out;
  }
}
