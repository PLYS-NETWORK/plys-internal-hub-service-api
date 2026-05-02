import { AbstractRepository } from '@common/repositories';
import { ConsultantTransaction } from '@database/entities';
import { ConsultantTransactionType } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import {
  IConsultantCompletedTaskRow,
  IConsultantEarningsTotals,
  IConsultantPaymentHistoryRow,
  IConsultantTransactionRepository,
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
}
