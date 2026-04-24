import { AbstractRepository } from '@common/repositories';
import { BillingPeriod } from '@database/entities';
import { Invoice } from '@database/entities/finance/invoice.entity';
import { BillingPeriodStatus } from '@database/enums';
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

  public async findWithInvoice(
    skip: number,
    take: number,
    status?: BillingPeriodStatus,
    businessId?: string,
  ): Promise<[BillingPeriod[], number]> {
    const qb = this.createQueryBuilder('bp')
      .leftJoinAndMapOne('bp.invoice', Invoice, 'invoice', 'invoice.billingPeriodId = bp.id')
      .orderBy('bp.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (status) {
      qb.andWhere('bp.status = :status', { status });
    }
    if (businessId) {
      qb.andWhere('bp.businessId = :businessId', { businessId });
    }

    return qb.getManyAndCount();
  }
}
