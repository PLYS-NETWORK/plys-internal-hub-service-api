import { AbstractRepository } from '@common/repositories';
import { BusinessTransaction } from '@database/entities';
import { BusinessTransactionType, TransactionStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import {
  IBusinessSpendTrendPoint,
  IBusinessTransactionRepository,
  IGmvTrendPoint,
  IPendingTopUpRow,
  IPublishingSpendSummary,
  ISpendTrendPoint,
} from './interfaces';

// Outflow that counts as "business spend" from the owner's POV. Refunds and
// withdraws are inflows back into the business wallet — explicitly excluded.
const BUSINESS_OUTFLOW_TYPES: readonly BusinessTransactionType[] = [
  BusinessTransactionType.TOP_UP,
  BusinessTransactionType.MONTHLY_BILLING,
  BusinessTransactionType.PROJECT_PUBLISHED,
  BusinessTransactionType.TASK_ADDED,
];

// Platform-wide GMV is the gross inflow from businesses: direct top-ups +
// monthly billing settlements. PROJECT_PUBLISHED and TASK_ADDED are internal
// debit entries against the business balance (no fresh external money), and
// REFUND / WITHDRAW are outflows — none belong in GMV.
const GMV_TYPES: readonly BusinessTransactionType[] = [
  BusinessTransactionType.TOP_UP,
  BusinessTransactionType.MONTHLY_BILLING,
];

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
  public async sumGmvBetween(from: Date, to: Date): Promise<string> {
    const row = await this.createQueryBuilder('bt')
      .select('COALESCE(SUM(bt.total_amount), 0)', 'amount')
      .where('bt.type IN (:...types)', { types: GMV_TYPES })
      .andWhere('bt.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('bt.created_at >= :from', { from })
      .andWhere('bt.created_at <= :to', { to })
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }

  /** @inheritdoc */
  public async sumGmvGroupedByPeriod(
    from: Date,
    to: Date,
    granularity: 'month' | 'week',
  ): Promise<IGmvTrendPoint[]> {
    const periodExpr =
      granularity === 'week'
        ? `to_char(bt.created_at, 'IYYY-IW')`
        : `to_char(date_trunc('month', bt.created_at), 'YYYY-MM')`;

    return this.createQueryBuilder('bt')
      .select(periodExpr, 'period_label')
      .addSelect('COALESCE(SUM(bt.total_amount), 0)', 'amount')
      .where('bt.type IN (:...types)', { types: GMV_TYPES })
      .andWhere('bt.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('bt.created_at >= :from', { from })
      .andWhere('bt.created_at <= :to', { to })
      .groupBy('period_label')
      .orderBy('period_label', 'ASC')
      .getRawMany<IGmvTrendPoint>();
  }

  /** @inheritdoc */
  public async sumBusinessOutflowBetween(
    businessId: string,
    from: Date,
    to: Date,
  ): Promise<string> {
    const row = await this.createQueryBuilder('bt')
      .select('COALESCE(SUM(bt.total_amount), 0)', 'amount')
      .where('bt.business_id = :businessId', { businessId })
      .andWhere('bt.type IN (:...types)', { types: BUSINESS_OUTFLOW_TYPES })
      .andWhere('bt.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('bt.created_at >= :from', { from })
      .andWhere('bt.created_at <= :to', { to })
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }

  /** @inheritdoc */
  public async sumBusinessOutflowGroupedByPeriod(
    businessId: string,
    from: Date,
    to: Date,
    granularity: 'month' | 'week',
  ): Promise<IBusinessSpendTrendPoint[]> {
    const periodExpr =
      granularity === 'week'
        ? `to_char(bt.created_at, 'IYYY-IW')`
        : `to_char(date_trunc('month', bt.created_at), 'YYYY-MM')`;

    return this.createQueryBuilder('bt')
      .select(periodExpr, 'period_label')
      .addSelect('COALESCE(SUM(bt.total_amount), 0)', 'amount')
      .where('bt.business_id = :businessId', { businessId })
      .andWhere('bt.type IN (:...types)', { types: BUSINESS_OUTFLOW_TYPES })
      .andWhere('bt.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('bt.created_at >= :from', { from })
      .andWhere('bt.created_at <= :to', { to })
      .groupBy('period_label')
      .orderBy('period_label', 'ASC')
      .getRawMany<IBusinessSpendTrendPoint>();
  }

  /** @inheritdoc */
  public async countPendingTopUpsByBusinessId(businessId: string): Promise<number> {
    return this.repository.count({
      where: {
        businessId,
        type: BusinessTransactionType.TOP_UP,
        status: TransactionStatus.PENDING,
      },
    });
  }

  /** @inheritdoc */
  public async findPendingTopUpsByBusinessId(
    businessId: string,
    limit: number,
  ): Promise<IPendingTopUpRow[]> {
    const rows = await this.createQueryBuilder('bt')
      .select('bt.id', 'transaction_id')
      .addSelect('bt.transaction_number', 'transaction_number')
      .addSelect('bt.total_amount', 'total_amount')
      .addSelect('bt.created_at', 'created_at')
      .addSelect('bt.processor_event_id', 'processor_event_id')
      .where('bt.business_id = :businessId', { businessId })
      .andWhere('bt.type = :type', { type: BusinessTransactionType.TOP_UP })
      .andWhere('bt.status = :status', { status: TransactionStatus.PENDING })
      .orderBy('bt.created_at', 'DESC')
      .limit(limit)
      .getRawMany<{
        transaction_id: string;
        transaction_number: string;
        total_amount: string;
        created_at: Date;
        processor_event_id: string | null;
      }>();
    // We don't store the redirect URL on the row — it has to be re-fetched
    // from the processor via the `continue` endpoint. Surface `null` here
    // and let the SPA decide whether to call `continue` proactively or wait
    // for a user click.
    return rows.map((r) => ({
      transaction_id: r.transaction_id,
      transaction_number: r.transaction_number,
      total_amount: r.total_amount,
      created_at: r.created_at,
      redirect_url: null,
    }));
  }

  /** @inheritdoc */
  public async sumProjectedMonthlyBillByBusinessId(businessId: string): Promise<string> {
    const row = await this.createQueryBuilder('bt')
      .innerJoin('bt.invoice', 'invoice')
      .innerJoin('invoice.billingPeriod', 'bp')
      .select('COALESCE(SUM(bt.total_amount), 0)', 'amount')
      .where('bt.business_id = :businessId', { businessId })
      .andWhere('bt.type = :type', { type: BusinessTransactionType.TASK_ADDED })
      .andWhere(`bp.status = 'open'`)
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }

  /** @inheritdoc */
  public async sumMtdSpendByProjectIds(
    projectIds: string[],
    from: Date,
    to: Date,
  ): Promise<Map<string, string>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.createQueryBuilder('bt')
      .select('bt.project_id', 'project_id')
      .addSelect('COALESCE(SUM(bt.total_amount), 0)', 'amount')
      .where('bt.project_id IN (:...projectIds)', { projectIds })
      .andWhere('bt.type IN (:...types)', { types: BUSINESS_OUTFLOW_TYPES })
      .andWhere('bt.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('bt.created_at >= :from', { from })
      .andWhere('bt.created_at <= :to', { to })
      .groupBy('bt.project_id')
      .getRawMany<{ project_id: string; amount: string }>();

    const out = new Map<string, string>();
    for (const r of rows) out.set(r.project_id, r.amount);
    return out;
  }
}
