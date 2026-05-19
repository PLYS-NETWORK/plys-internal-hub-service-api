import { AbstractRepository } from '@common/repositories';
import { ConsultantTransaction } from '@database/entities';
import { ConsultantTransactionType, TransactionStatus } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import {
  IConsultantCompletedTaskRow,
  IConsultantEarningsBucket,
  IConsultantEarningsTotals,
  IConsultantPaymentHistoryRow,
  IConsultantPendingWithdrawalRow,
  IConsultantTransactionRepository,
  IPayoutsTrendPoint,
} from './interfaces';

@Injectable()
export class ConsultantTransactionRepository
  extends AbstractRepository<ConsultantTransaction>
  implements IConsultantTransactionRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ConsultantTransaction, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ConsultantTransactionRepository(manager) as this;
  }

  /** @inheritdoc */
  public async sumEarningsByConsultantAndProject(
    consultantId: string,
    projectId: string,
  ): Promise<IConsultantEarningsTotals> {
    const row = await this.createQueryBuilder('ct')
      .select(
        `COALESCE(SUM(CASE WHEN ct.type = '${ConsultantTransactionType.CREDIT_CLEARED}' THEN ct.amount ELSE 0 END), 0)`,
        'total_earned',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN ct.type = '${ConsultantTransactionType.CREDIT_PENDING}' THEN ct.amount ELSE 0 END), 0)`,
        'pending_amount',
      )
      .where('ct.consultant_id = :consultantId', { consultantId })
      .andWhere('ct.project_id = :projectId', { projectId })
      .getRawOne<{ total_earned: string; pending_amount: string }>();

    return {
      totalEarned: Number(row?.total_earned ?? 0),
      pendingAmount: Number(row?.pending_amount ?? 0),
    };
  }

  /** @inheritdoc */
  public async findCompletedTasksByConsultantAndProject(
    consultantId: string,
    projectId: string,
  ): Promise<IConsultantCompletedTaskRow[]> {
    const rows = await this.createQueryBuilder('ct')
      .leftJoin('ct.task', 'task')
      .select('ct.id', 'id')
      .addSelect('task.id', 'task_id')
      .addSelect('task.code', 'task_code')
      .addSelect('task.title', 'task_title')
      .addSelect('ct.amount', 'amount')
      .addSelect('ct.created_at', 'paid_at')
      .where('ct.consultant_id = :consultantId', { consultantId })
      .andWhere('ct.project_id = :projectId', { projectId })
      .andWhere(`ct.type = '${ConsultantTransactionType.CREDIT_CLEARED}'`)
      .orderBy('ct.created_at', 'DESC')
      .addOrderBy('ct.id', 'DESC')
      .getRawMany<{
        id: string;
        task_id: string | null;
        task_code: string | null;
        task_title: string | null;
        amount: string;
        paid_at: Date;
      }>();

    return rows.map((r) => ({
      id: r.id,
      task_id: r.task_id,
      task_code: r.task_code,
      task_title: r.task_title,
      amount: Number(r.amount),
      paid_at: r.paid_at,
    }));
  }

  /** @inheritdoc */
  public async findPaymentHistoryByConsultantAndProject(
    consultantId: string,
    projectId: string,
  ): Promise<IConsultantPaymentHistoryRow[]> {
    const rows = await this.createQueryBuilder('ct')
      .leftJoin('ct.invoice', 'invoice')
      .leftJoin('invoice.billingPeriod', 'bp')
      .select('ct.id', 'id')
      .addSelect('ct.transaction_number', 'transaction_number')
      .addSelect('ct.amount', 'amount')
      .addSelect('ct.status', 'status')
      .addSelect('ct.created_at', 'paid_at')
      .addSelect('bp.period_start', 'period_start')
      .addSelect('bp.period_end', 'period_end')
      .where('ct.consultant_id = :consultantId', { consultantId })
      .andWhere('ct.project_id = :projectId', { projectId })
      .andWhere('ct.type IN (:...types)', {
        types: [ConsultantTransactionType.CREDIT_CLEARED, ConsultantTransactionType.CREDIT_PENDING],
      })
      .orderBy('ct.created_at', 'DESC')
      .addOrderBy('ct.id', 'DESC')
      .getRawMany<{
        id: string;
        transaction_number: string;
        amount: string;
        status: string;
        paid_at: Date;
        period_start: string | null;
        period_end: string | null;
      }>();

    return rows.map((r) => ({
      id: r.id,
      transaction_number: r.transaction_number,
      amount: Number(r.amount),
      status: r.status,
      paid_at: r.paid_at,
      period_start: r.period_start,
      period_end: r.period_end,
    }));
  }

  /** @inheritdoc */
  public async sumPayoutsBetween(from: Date, to: Date): Promise<string> {
    const row = await this.createQueryBuilder('ct')
      .select('COALESCE(SUM(ct.amount), 0)', 'amount')
      .where('ct.type = :type', { type: ConsultantTransactionType.WITHDRAWAL })
      .andWhere('ct.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('ct.created_at >= :from', { from })
      .andWhere('ct.created_at <= :to', { to })
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }

  /** @inheritdoc */
  public async sumPayoutsGroupedByPeriod(
    from: Date,
    to: Date,
    granularity: 'month' | 'week',
  ): Promise<IPayoutsTrendPoint[]> {
    const periodExpr =
      granularity === 'week'
        ? `to_char(ct.created_at, 'IYYY-IW')`
        : `to_char(date_trunc('month', ct.created_at), 'YYYY-MM')`;

    return this.createQueryBuilder('ct')
      .select(periodExpr, 'period_label')
      .addSelect('COALESCE(SUM(ct.amount), 0)', 'amount')
      .where('ct.type = :type', { type: ConsultantTransactionType.WITHDRAWAL })
      .andWhere('ct.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('ct.created_at >= :from', { from })
      .andWhere('ct.created_at <= :to', { to })
      .groupBy('period_label')
      .orderBy('period_label', 'ASC')
      .getRawMany<IPayoutsTrendPoint>();
  }

  /** @inheritdoc */
  public async countPendingWithdrawals(): Promise<number> {
    return this.repository.count({
      where: {
        type: ConsultantTransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING,
      },
    });
  }

  /** @inheritdoc */
  public async sumAmountByConsultantAndTypes(
    consultantId: string,
    types: ConsultantTransactionType[],
  ): Promise<string> {
    if (types.length === 0) return '0.00';
    const row = await this.createQueryBuilder('ct')
      .select('COALESCE(SUM(ct.amount), 0)', 'amount')
      .where('ct.consultant_id = :consultantId', { consultantId })
      .andWhere('ct.type IN (:...types)', { types })
      .andWhere('ct.status = :status', { status: TransactionStatus.COMPLETED })
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }

  /** @inheritdoc */
  public async sumAmountByConsultantTypesStatusBetween(
    consultantId: string,
    types: ConsultantTransactionType[],
    status: TransactionStatus,
    from: Date,
    to: Date,
  ): Promise<string> {
    if (types.length === 0) return '0.00';
    const row = await this.createQueryBuilder('ct')
      .select('COALESCE(SUM(ct.amount), 0)', 'amount')
      .where('ct.consultant_id = :consultantId', { consultantId })
      .andWhere('ct.type IN (:...types)', { types })
      .andWhere('ct.status = :status', { status })
      .andWhere('ct.created_at >= :from', { from })
      .andWhere('ct.created_at <= :to', { to })
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }

  /** @inheritdoc */
  public async sumPendingCreditsByConsultantId(consultantId: string): Promise<string> {
    const row = await this.createQueryBuilder('ct')
      .select('COALESCE(SUM(ct.amount), 0)', 'amount')
      .where('ct.consultant_id = :consultantId', { consultantId })
      .andWhere('ct.type = :type', { type: ConsultantTransactionType.CREDIT_PENDING })
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }

  /** @inheritdoc */
  public async sumByConsultantGroupedByPeriodAndType(
    consultantId: string,
    types: ConsultantTransactionType[],
    from: Date,
    to: Date,
    granularity: 'month' | 'week',
  ): Promise<IConsultantEarningsBucket[]> {
    if (types.length === 0) return [];
    const periodExpr =
      granularity === 'week'
        ? `to_char(ct.created_at, 'IYYY-IW')`
        : `to_char(date_trunc('month', ct.created_at), 'YYYY-MM')`;

    const rows = await this.createQueryBuilder('ct')
      .select(periodExpr, 'period_label')
      .addSelect('ct.type', 'type')
      .addSelect('COALESCE(SUM(ct.amount), 0)', 'amount')
      .where('ct.consultant_id = :consultantId', { consultantId })
      .andWhere('ct.type IN (:...types)', { types })
      .andWhere('ct.created_at >= :from', { from })
      .andWhere('ct.created_at <= :to', { to })
      .groupBy('period_label')
      .addGroupBy('ct.type')
      .orderBy('period_label', 'ASC')
      .addOrderBy('ct.type', 'ASC')
      .getRawMany<{
        period_label: string;
        type: ConsultantTransactionType;
        amount: string;
      }>();
    return rows.map((r) => ({
      period_label: r.period_label,
      type: r.type,
      amount: r.amount,
    }));
  }

  /** @inheritdoc */
  public async countPendingWithdrawalsByConsultantId(consultantId: string): Promise<number> {
    return this.repository.count({
      where: {
        consultantId,
        type: ConsultantTransactionType.WITHDRAWAL,
        status: TransactionStatus.PENDING,
      },
    });
  }

  /** @inheritdoc */
  public async findPendingWithdrawalsByConsultantId(
    consultantId: string,
    limit: number,
  ): Promise<IConsultantPendingWithdrawalRow[]> {
    const rows = await this.createQueryBuilder('ct')
      .select('ct.id', 'transaction_id')
      .addSelect('ct.transaction_number', 'transaction_number')
      .addSelect('ct.amount', 'amount')
      .addSelect('ct.withdrawal_method', 'withdrawal_method')
      .addSelect('ct.created_at', 'created_at')
      .where('ct.consultant_id = :consultantId', { consultantId })
      .andWhere('ct.type = :type', { type: ConsultantTransactionType.WITHDRAWAL })
      .andWhere('ct.status = :status', { status: TransactionStatus.PENDING })
      .orderBy('ct.created_at', 'DESC')
      .addOrderBy('ct.id', 'DESC')
      .limit(limit)
      .getRawMany<{
        transaction_id: string;
        transaction_number: string;
        amount: string;
        withdrawal_method: string | null;
        created_at: Date;
      }>();
    return rows.map((r) => ({
      transaction_id: r.transaction_id,
      transaction_number: r.transaction_number,
      amount: r.amount,
      withdrawal_method: r.withdrawal_method,
      created_at: r.created_at,
    }));
  }

  /** @inheritdoc */
  public async sumClearedEarningsByConsultantGroupedByProject(
    consultantId: string,
    projectIds: string[],
  ): Promise<Map<string, string>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.createQueryBuilder('ct')
      .select('ct.project_id', 'project_id')
      .addSelect('COALESCE(SUM(ct.amount), 0)', 'amount')
      .where('ct.consultant_id = :consultantId', { consultantId })
      .andWhere('ct.type = :type', { type: ConsultantTransactionType.CREDIT_CLEARED })
      .andWhere('ct.project_id IN (:...projectIds)', { projectIds })
      .groupBy('ct.project_id')
      .getRawMany<{ project_id: string; amount: string }>();
    const out = new Map<string, string>();
    for (const row of rows) out.set(row.project_id, row.amount);
    return out;
  }

  /** @inheritdoc */
  public async sumClearedEarningsByConsultantAndSkillId(
    consultantId: string,
    skillId: string,
  ): Promise<string> {
    // CREDIT_CLEARED rows whose source task belongs to a project that lists
    // the skill as required. The project may require multiple skills, so a
    // single earning row contributes to every matching skill — the FE label
    // wording on the DTO explains this semantic to avoid double-count
    // surprises.
    const row = await this.createQueryBuilder('ct')
      .innerJoin('tasks', 'task', 'task.id = ct.task_id')
      .innerJoin(
        'project_required_skills',
        'prs',
        'prs.project_id = task.project_id AND prs.skill_id = :skillId',
        { skillId },
      )
      .select('COALESCE(SUM(ct.amount), 0)', 'amount')
      .where('ct.consultant_id = :consultantId', { consultantId })
      .andWhere('ct.type = :type', { type: ConsultantTransactionType.CREDIT_CLEARED })
      .getRawOne<{ amount: string }>();
    return row?.amount ?? '0.00';
  }
}
