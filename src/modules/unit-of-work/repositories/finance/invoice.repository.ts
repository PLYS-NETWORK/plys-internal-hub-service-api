import { AbstractRepository } from '@common/repositories';
import { Invoice } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IInvoiceRepository } from './interfaces';

@Injectable()
export class InvoiceRepository
  extends AbstractRepository<Invoice>
  implements IInvoiceRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(Invoice, manager);
  }

  public withManager(manager: EntityManager): this {
    return new InvoiceRepository(manager) as this;
  }
}
