import { AbstractRepository } from '@common/repositories';
import { ConsultantTransaction } from '@database/entities';
import { ConsultantTransactionType, TransactionStatus } from '@database/enums';

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

/** Per-(period, type) bucket for the consultant earnings-trend endpoint. */
export interface IConsultantEarningsBucket {
  /** `YYYY-MM` for monthly, `IYYY-IW` for weekly. */
  period_label: string;
  /** The ledger type this bucket aggregates. */
  type: ConsultantTransactionType;
  /** SUM(amount) — fixed-point decimal string. */
  amount: string;
}

/** Row returned by the pending-withdrawals action-items query. */
export interface IConsultantPendingWithdrawalRow {
  transaction_id: string;
  transaction_number: string;
  amount: string;
  withdrawal_method: string | null;
  created_at: Date;
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

  /**
   * Sums `amount` for a single consultant filtered by one or more ledger types,
   * always restricted to `status = COMPLETED`. Used by the consultant dashboard
   * summary for figures like `lifetime_earnings` (CREDIT_CLEARED) and
   * `pending_credits` (CREDIT_PENDING — the only type where PENDING is
   * meaningful — see `sumPendingCreditsByConsultantId`).
   * @param consultantId Owner of the ledger.
   * @param types Non-empty list of ledger types to include.
   * @returns Decimal string (`'0.00'` when empty).
   */
  sumAmountByConsultantAndTypes(
    consultantId: string,
    types: ConsultantTransactionType[],
  ): Promise<string>;

  /**
   * Sums `amount` for a single consultant filtered by ledger type + status +
   * a `created_at` window. Used by MTD figures on the dashboard summary
   * (cleared_credits_mtd, total_withdrawn_mtd).
   * @returns Decimal string (`'0.00'` when empty).
   */
  sumAmountByConsultantTypesStatusBetween(
    consultantId: string,
    types: ConsultantTransactionType[],
    status: TransactionStatus,
    from: Date,
    to: Date,
  ): Promise<string>;

  /**
   * Sums `amount` for `CREDIT_PENDING` rows regardless of completion status.
   * CREDIT_PENDING is the accrual state — money owed but not yet released —
   * so the dashboard wants the gross outstanding balance, not just COMPLETED
   * rows.
   */
  sumPendingCreditsByConsultantId(consultantId: string): Promise<string>;

  /**
   * Time-series of consultant earnings/withdrawals grouped by (period, type).
   * Status pinned to `COMPLETED` for cleared/withdrawn types and
   * `CREDIT_PENDING` rows are included by their `created_at`. Sorted by
   * `period_label` ASC, then `type` ASC for deterministic merging service-side.
   * @param consultantId Owner.
   * @param types Non-empty list of ledger types to bucket.
   * @param from Inclusive lower bound on `created_at`.
   * @param to Inclusive upper bound on `created_at`.
   * @param granularity `'month'` or `'week'` — drives the period_label format.
   */
  sumByConsultantGroupedByPeriodAndType(
    consultantId: string,
    types: ConsultantTransactionType[],
    from: Date,
    to: Date,
    granularity: 'month' | 'week',
  ): Promise<IConsultantEarningsBucket[]>;

  /**
   * Counts pending withdrawals for a single consultant — surface metric for
   * the dashboard `action_counts.pending_withdrawals`. Filter:
   * `type = WITHDRAWAL AND status = PENDING AND consultant_id = $1`.
   */
  countPendingWithdrawalsByConsultantId(consultantId: string): Promise<number>;

  /**
   * Top-N pending-withdrawal rows for the consultant action-items category.
   * Sorted by `created_at` DESC (newest first). Returns the columns the FE
   * surfaces directly so no join is needed at the service layer.
   */
  findPendingWithdrawalsByConsultantId(
    consultantId: string,
    limit: number,
  ): Promise<IConsultantPendingWithdrawalRow[]>;

  /**
   * Sum of CREDIT_CLEARED `amount` grouped by `project_id` for one consultant.
   * Used by the consultant project-progress table's `my_earnings_in_project`
   * column. Projects with zero earnings are absent from the result.
   * @param consultantId Owner.
   * @param projectIds Universe to restrict to.
   * @returns Map of `projectId → decimal string`.
   */
  sumClearedEarningsByConsultantGroupedByProject(
    consultantId: string,
    projectIds: string[],
  ): Promise<Map<string, string>>;

  /**
   * Sum of CREDIT_CLEARED `amount` for one consultant where the underlying
   * task belongs to a project that requires the given skill. Joins through
   * `tasks` → `project_required_skills`. Used by skill-performance
   * `earnings_from_skill`.
   * @returns Decimal string (`'0.00'` when empty).
   */
  sumClearedEarningsByConsultantAndSkillId(consultantId: string, skillId: string): Promise<string>;
}
