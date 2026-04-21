import { AbstractRepository } from '@common/repositories';
import { ConsultantTransaction } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IConsultantTransactionRepository } from './interfaces';

@Injectable()
export class ConsultantTransactionRepository
  extends AbstractRepository<ConsultantTransaction>
  implements IConsultantTransactionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ConsultantTransaction, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantTransactionRepository(manager) as this;
  }
}
