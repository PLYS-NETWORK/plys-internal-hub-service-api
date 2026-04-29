import { AbstractRepository } from '@common/repositories';
import { BusinessTransaction } from '@database/entities';
import { BusinessTransactionType, TransactionStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import {
  IBusinessTransactionRepository,
  ILatestPublishPayment,
  IPublishingSpendSummary,
  ISpendTrendPoint,
} from './interfaces';

@Injectable()
export class BusinessTransactionRepository
  extends AbstractRepository<BusinessTransaction>
  implements IBusinessTransactionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(BusinessTransaction, manager);
  }

  public withManager(manager: EntityManager): this {
    return new BusinessTransactionRepository(manager) as this;
  }

  /** @inheritdoc */
  public async getPublishingSpendSummaryByBusinessId(
    businessId: string,
  ): Promise<IPublishingSpendSummary> {
    const row = await this.createQueryBuilder('bt')
      .select('COALESCE(SUM(bt.total_amount), 0)', 'total_spend')
      .addSelect('COUNT(DISTINCT bt.project_id)', 'total_published_projects')
      .addSelect('MAX(bt.created_at)', 'last_payment_at')
      .where('bt.business_id = :businessId', { businessId })
      .andWhere('bt.type = :type', { type: BusinessTransactionType.PROJECT_PUBLISHED })
      .andWhere('bt.status = :status', { status: TransactionStatus.COMPLETED })
      .getRawOne<{
        total_spend: string;
        total_published_projects: string;
        last_payment_at: Date | null;
      }>();

    return {
      total_spend: row?.total_spend ?? '0.00',
      total_published_projects: Number(row?.total_published_projects ?? 0),
      last_payment_at: row?.last_payment_at ?? null,
    };
  }

  /** @inheritdoc */
  public async sumPublishingSpendByBusinessIdGroupedByMonth(
    businessId: string,
    from?: string,
    to?: string,
  ): Promise<ISpendTrendPoint[]> {
    const qb = this.createQueryBuilder('bt')
      .select(`to_char(date_trunc('month', bt.created_at), 'YYYY-MM')`, 'period_label')
      .addSelect('COALESCE(SUM(bt.total_amount), 0)', 'amount')
      .where('bt.business_id = :businessId', { businessId })
      .andWhere('bt.type = :type', { type: BusinessTransactionType.PROJECT_PUBLISHED })
      .andWhere('bt.status = :status', { status: TransactionStatus.COMPLETED });

    if (from) qb.andWhere('bt.created_at >= :from', { from });
    if (to) qb.andWhere('bt.created_at <= :to', { to });

    return qb.groupBy('period_label').orderBy('period_label', 'ASC').getRawMany<ISpendTrendPoint>();
  }

  /** @inheritdoc */
  public async findLatestPublishPaymentByProjectId(
    projectId: string,
  ): Promise<ILatestPublishPayment | null> {
    const row = await this.createQueryBuilder('bt')
      .select('bt.total_amount', 'amount')
      .addSelect('bt.created_at', 'paid_at')
      .where('bt.project_id = :projectId', { projectId })
      .andWhere('bt.type = :type', { type: BusinessTransactionType.PROJECT_PUBLISHED })
      .andWhere('bt.status = :status', { status: TransactionStatus.COMPLETED })
      .orderBy('bt.created_at', 'DESC')
      .limit(1)
      .getRawOne<{ amount: string; paid_at: Date }>();

    if (!row) return null;
    // Currency hard-coded to USD until the multi-currency story lands — matches
    // the `Currency` enum which only has USD today.
    return { amount: row.amount, paid_at: row.paid_at, currency: 'USD' };
  }

  /** @inheritdoc */
  public async findPublishPaymentsByProjectIds(projectIds: string[]): Promise<Map<string, string>> {
    if (projectIds.length === 0) return new Map();

    // DISTINCT ON gives us the latest transaction per project in one pass —
    // Postgres-specific, but the rest of this codebase already targets Postgres.
    const rows = await this.createQueryBuilder('bt')
      .select('DISTINCT ON (bt.project_id) bt.project_id', 'project_id')
      .addSelect('bt.total_amount', 'total_amount')
      .where('bt.project_id IN (:...projectIds)', { projectIds })
      .andWhere('bt.type = :type', { type: BusinessTransactionType.PROJECT_PUBLISHED })
      .andWhere('bt.status = :status', { status: TransactionStatus.COMPLETED })
      .orderBy('bt.project_id')
      .addOrderBy('bt.created_at', 'DESC')
      .getRawMany<{ project_id: string; total_amount: string }>();

    const byProject = new Map<string, string>();
    for (const row of rows) {
      byProject.set(row.project_id, row.total_amount);
    }
    return byProject;
  }
}
