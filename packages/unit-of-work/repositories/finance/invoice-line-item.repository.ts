import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { InvoiceLineItem } from '@plys/libraries/database/entities';
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
