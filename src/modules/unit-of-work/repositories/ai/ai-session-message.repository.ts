import { AbstractRepository } from '@common/repositories';
import { AiSessionMessage } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IAiSessionMessageRepository } from './interfaces';

@Injectable()
export class AiSessionMessageRepository
  extends AbstractRepository<AiSessionMessage>
  implements IAiSessionMessageRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(AiSessionMessage, manager);
  }

  public withManager(manager: EntityManager): this {
    return new AiSessionMessageRepository(manager) as this;
  }
}
