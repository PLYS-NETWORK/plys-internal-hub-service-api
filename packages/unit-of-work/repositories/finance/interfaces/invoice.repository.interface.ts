import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { Invoice } from '@plys/libraries/database/entities';

/** Overdue invoice row surfaced in the business action-items endpoint. */
export interface IOverdueInvoiceRow {
  invoice_id: string;
  amount: string;
  due_date: Date;
  days_overdue: number;
}

export interface IInvoiceRepository extends AbstractRepository<Invoice> {
  /**
   * Sums outstanding invoice amounts — `status IN (PENDING, OVERDUE)`. Used by
   * the admin dashboard's financial KPIs to show money owed to the platform.
   * @returns Decimal string (`'0.00'` when no rows).
   */
  sumOutstandingAmount(): Promise<string>;

  /**
   * Counts invoices in `OVERDUE` status. Used by the operational queue card.
   */
  countOverdue(): Promise<number>;

  /**
   * Per-business version of {@link sumOutstandingAmount}. Powers the
   * `outstanding_invoices_amount` KPI on the business dashboard.
   */
  sumOutstandingAmountByBusinessId(businessId: string): Promise<string>;

  /**
   * Per-business count of invoices in PENDING or OVERDUE status.
   */
  countOutstandingByBusinessId(businessId: string): Promise<number>;

  /**
   * Top-N OVERDUE invoices for the business, sorted by `due_date` ASC
   * (most-overdue first). `days_overdue` is `EXTRACT(DAY FROM NOW() - due_date)`.
   */
  findOverdueByBusinessId(businessId: string, limit: number): Promise<IOverdueInvoiceRow[]>;
}
