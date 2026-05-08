import { AbstractRepository } from '@common/repositories';
import { IdempotencyKey } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IIdempotencyKeyRepository } from './interfaces';

@Injectable()
export class IdempotencyKeyRepository
  extends AbstractRepository<IdempotencyKey>
  implements IIdempotencyKeyRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(IdempotencyKey, manager);
  }

  public withManager(manager: EntityManager): this {
    return new IdempotencyKeyRepository(manager) as this;
  }
}
