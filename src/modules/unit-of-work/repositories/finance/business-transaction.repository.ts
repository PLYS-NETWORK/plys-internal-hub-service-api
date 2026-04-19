import { AbstractRepository } from '@common/repositories';
import { BusinessTransaction } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IBusinessTransactionRepository } from './interfaces';

@Injectable()
export class BusinessTransactionRepository
  extends AbstractRepository<BusinessTransaction>
  implements IBusinessTransactionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(BusinessTransaction, manager);
  }

  public withManager(manager: EntityManager): this {
    return new BusinessTransactionRepository(manager) as this;
  }
}
