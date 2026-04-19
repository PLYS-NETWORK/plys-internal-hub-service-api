import { AbstractRepository } from '@common/repositories';
import { InvoiceLineItem } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IInvoiceLineItemRepository } from './interfaces';

@Injectable()
export class InvoiceLineItemRepository
  extends AbstractRepository<InvoiceLineItem>
  implements IInvoiceLineItemRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(InvoiceLineItem, manager);
  }

  public withManager(manager: EntityManager): this {
    return new InvoiceLineItemRepository(manager) as this;
  }
}
