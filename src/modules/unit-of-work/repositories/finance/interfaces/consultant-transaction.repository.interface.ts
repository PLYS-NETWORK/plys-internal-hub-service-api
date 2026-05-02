import { AbstractRepository } from '@common/repositories';
import { ConsultantTransaction } from '@database/entities';

export interface IConsultantEarningsTotals {
  /** Sum of `amount` where `type = CREDIT_CLEARED` (paid-out earnings). */
  totalEarned: number;
  /** Sum of `amount` where `type = CREDIT_PENDING` (accrued, not yet paid). */
  pendingAmount: number;
}

export interface IConsultantCompletedTaskRow {
  /** Ledger row id (idempotent reference for FE). */
  id: string;
  /** Underlying task id (may be null if the task was hard-deleted). */
  task_id: string | null;
  task_code: string | null;
  task_title: string | null;
  amount: number;
  paid_at: Date;
}

export interface IConsultantPaymentHistoryRow {
  id: string;
  transaction_number: string;
  amount: number;
  status: string;
  paid_at: Date;
  /** From the linked invoice's billing period, if any. */
  period_start: string | null;
  period_end: string | null;
}

export interface IConsultantTransactionRepository extends AbstractRepository<ConsultantTransaction> {
  /**
   * Returns the consultant's per-project earnings split between cleared and
   * pending amounts in a single round-trip. Excludes withdrawals and
   * reversals.
   */
  sumEarningsByConsultantAndProject(
    consultantId: string,
    projectId: string,
  ): Promise<IConsultantEarningsTotals>;

  /**
   * Returns CREDIT_CLEARED rows for the consultant + project joined to their
   * source task. Used by the per-task overview to render `completed_tasks`.
   */
  findCompletedTasksByConsultantAndProject(
    consultantId: string,
    projectId: string,
  ): Promise<IConsultantCompletedTaskRow[]>;

  /**
   * Returns the per-month payment history for a consultant on a project. The
   * `period_*` columns come from the linked invoice's billing period; rows
   * without an invoice carry `null` periods.
   */
  findPaymentHistoryByConsultantAndProject(
    consultantId: string,
    projectId: string,
  ): Promise<IConsultantPaymentHistoryRow[]>;
}
