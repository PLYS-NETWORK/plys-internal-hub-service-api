import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { Invoice } from '@plys/libraries/database/entities';
import { InvoiceStatus } from '@plys/libraries/database/enums';
import { EntityManager } from 'typeorm';

import { IInvoiceRepository, IOverdueInvoiceRow } from './interfaces';

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

  /** @inheritdoc */
  public async sumOutstandingAmountByBusinessId(businessId: string): Promise<string> {
    const row = await this.createQueryBuilder('i')
      .select('COALESCE(SUM(i.amount), 0)', 'amount')
      .where('i.business_id = :businessId', { businessId })
      .andWhere('i.status IN (:...statuses)', { statuses: OUTSTANDING_STATUSES })
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }

  /** @inheritdoc */
  public async countOutstandingByBusinessId(businessId: string): Promise<number> {
    return this.repository.count({
      where: OUTSTANDING_STATUSES.map((status) => ({ businessId, status })),
    });
  }

  /** @inheritdoc */
  public async findOverdueByBusinessId(
    businessId: string,
    limit: number,
  ): Promise<IOverdueInvoiceRow[]> {
    const rows = await this.createQueryBuilder('i')
      .select('i.id', 'invoice_id')
      .addSelect('i.amount', 'amount')
      .addSelect('i.due_date', 'due_date')
      .addSelect('EXTRACT(DAY FROM (NOW() - i.due_date))::int', 'days_overdue')
      .where('i.business_id = :businessId', { businessId })
      .andWhere('i.status = :status', { status: InvoiceStatus.OVERDUE })
      .orderBy('i.due_date', 'ASC')
      .limit(limit)
      .getRawMany<{ invoice_id: string; amount: string; due_date: Date; days_overdue: number }>();
    return rows.map((r) => ({
      invoice_id: r.invoice_id,
      amount: r.amount,
      due_date: r.due_date,
      days_overdue: Number(r.days_overdue),
    }));
  }
}
