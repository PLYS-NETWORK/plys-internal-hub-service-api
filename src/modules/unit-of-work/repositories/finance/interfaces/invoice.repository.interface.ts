import { AbstractRepository } from '@common/repositories';
import { Invoice } from '@database/entities';

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
}
