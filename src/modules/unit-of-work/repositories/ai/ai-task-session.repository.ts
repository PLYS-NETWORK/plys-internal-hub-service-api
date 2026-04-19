import { AbstractRepository } from '@common/repositories';
import { AiTaskSession } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IAiTaskSessionRepository } from './interfaces';

@Injectable()
export class AiTaskSessionRepository
  extends AbstractRepository<AiTaskSession>
  implements IAiTaskSessionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(AiTaskSession, manager);
  }

  public withManager(manager: EntityManager): this {
    return new AiTaskSessionRepository(manager) as this;
  }
}
