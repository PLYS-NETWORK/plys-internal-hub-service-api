import { AbstractRepository } from '@common/repositories';
import { ConsultantSkillScore } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
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
  public async findByConsultantId(consultantId: string): Promise<ConsultantSkillScore[]> {
    return this.find({ where: { consultantId } });
  }
}
