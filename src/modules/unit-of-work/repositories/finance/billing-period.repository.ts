import { AbstractRepository } from '@common/repositories';
import { BillingPeriod } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IBillingPeriodRepository } from './interfaces';

@Injectable()
export class BillingPeriodRepository
  extends AbstractRepository<BillingPeriod>
  implements IBillingPeriodRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(BillingPeriod, manager);
  }

  public withManager(manager: EntityManager): this {
    return new BillingPeriodRepository(manager) as this;
  }
}
