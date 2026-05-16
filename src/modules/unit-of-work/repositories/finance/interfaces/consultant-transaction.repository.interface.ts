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

/** Time-series point for platform-wide consultant payouts. */
export interface IPayoutsTrendPoint {
  /** `YYYY-MM` for monthly, `IYYY-IW` for weekly. */
  period_label: string;
  /** SUM(amount) inside this period — fixed-point string from Postgres. */
  amount: string;
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

  /**
   * Platform-wide consultant payouts in a window — sum of `amount` for
   * COMPLETED `WITHDRAWAL` rows. Used by the admin dashboard's financial KPIs.
   * @param from Inclusive lower bound on `created_at`.
   * @param to   Inclusive upper bound on `created_at`.
   * @returns Decimal string (`'0.00'` when empty).
   */
  sumPayoutsBetween(from: Date, to: Date): Promise<string>;

  /**
   * Platform-wide consultant payouts grouped by period (admin growth chart).
   * Same filter as {@link sumPayoutsBetween}. Sorted ascending by `period_label`.
   */
  sumPayoutsGroupedByPeriod(
    from: Date,
    to: Date,
    granularity: 'month' | 'week',
  ): Promise<IPayoutsTrendPoint[]>;

  /**
   * Counts pending withdrawal rows across all consultants (operational queue).
   * Filter: `type = WITHDRAWAL AND status = PENDING`.
   */
  countPendingWithdrawals(): Promise<number>;
}
