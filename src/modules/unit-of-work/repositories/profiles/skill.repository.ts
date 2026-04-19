import { AbstractRepository } from '@common/repositories';
import { Skill } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
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
