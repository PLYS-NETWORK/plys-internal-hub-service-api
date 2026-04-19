import { AbstractRepository } from '@common/repositories';
import { ConsultantSkill } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IConsultantSkillRepository } from './interfaces';

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
}
