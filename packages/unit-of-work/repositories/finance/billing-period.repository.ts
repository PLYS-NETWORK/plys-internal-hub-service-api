import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { BillingPeriod } from '@plys/libraries/database/entities';
import { Invoice } from '@plys/libraries/database/entities/finance/invoice.entity';
import { BillingPeriodStatus } from '@plys/libraries/database/enums';
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
