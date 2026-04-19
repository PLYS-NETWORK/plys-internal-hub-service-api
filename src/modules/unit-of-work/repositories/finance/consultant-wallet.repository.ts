import { AbstractRepository } from '@common/repositories';
import { ConsultantWallet } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IConsultantWalletRepository } from './interfaces';

@Injectable()
export class ConsultantWalletRepository
  extends AbstractRepository<ConsultantWallet>
  implements IConsultantWalletRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ConsultantWallet, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantWalletRepository(manager) as this;
  }
}
