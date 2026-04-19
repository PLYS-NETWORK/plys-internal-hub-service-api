import { AbstractRepository } from '@common/repositories';
import { WalletTransaction } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IWalletTransactionRepository } from './interfaces';

@Injectable()
export class WalletTransactionRepository
  extends AbstractRepository<WalletTransaction>
  implements IWalletTransactionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(WalletTransaction, manager);
  }

  public withManager(manager: EntityManager): this {
    return new WalletTransactionRepository(manager) as this;
  }
}
