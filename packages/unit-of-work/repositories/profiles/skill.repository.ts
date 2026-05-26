import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { Skill } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { ISkillRepository } from './interfaces';

@Injectable()
export class SkillRepository extends AbstractRepository<Skill> implements ISkillRepository {
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(Skill, manager);
  }

  public withManager(manager: EntityManager): this {
    return new SkillRepository(manager) as this;
  }
}
