import { AbstractRepository } from '@common/repositories';
import { Invoice } from '@database/entities';
import { InvoiceStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IInvoiceRepository } from './interfaces';

const OUTSTANDING_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.PENDING,
  InvoiceStatus.OVERDUE,
];

@Injectable()
export class InvoiceRepository extends AbstractRepository<Invoice> implements IInvoiceRepository {
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(Invoice, manager);
  }

  public withManager(manager: EntityManager): this {
    return new InvoiceRepository(manager) as this;
  }

  /** @inheritdoc */
  public async sumOutstandingAmount(): Promise<string> {
    const row = await this.createQueryBuilder('i')
      .select('COALESCE(SUM(i.amount), 0)', 'amount')
      .where('i.status IN (:...statuses)', { statuses: OUTSTANDING_STATUSES })
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }

  /** @inheritdoc */
  public async countOverdue(): Promise<number> {
    return this.repository.count({ where: { status: InvoiceStatus.OVERDUE } });
  }
}
