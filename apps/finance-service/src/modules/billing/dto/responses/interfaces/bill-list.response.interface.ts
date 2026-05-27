import { BillingPeriodStatus, InvoiceStatus } from '@plys/libraries/database/enums';

export interface IBillInvoiceSummaryResponse {
  /** UUID of the invoice record. */
  readonly id: string;
  /** Total invoice amount (decimal string). */
  readonly amount: string;
  /** ISO 4217 currency code for the invoice (e.g. `"USD"`). */
  readonly currency: string;
  /** Current payment status of the invoice (e.g. `pending`, `paid`, `overdue`). */
  readonly status: InvoiceStatus;
  /** ISO 8601 date string of the payment due date; `null` when not yet set. */
  readonly due_date: string | null;
  /** Timestamp when the invoice was paid; `null` until payment is confirmed. */
  readonly paid_at: Date | null;
}

export interface IBillListResponse {
  /** UUID of the billing period record. */
  readonly id: string;
  /** UUID of the business this billing period belongs to. */
  readonly business_id: string;
  /** ISO 8601 date string marking the start of the billing period (inclusive). */
  readonly period_start: string;
  /** ISO 8601 date string marking the end of the billing period (inclusive). */
  readonly period_end: string;
  /** Current lifecycle status of the billing period (e.g. `open`, `finalized`, `paid`). */
  readonly status: BillingPeriodStatus;
  /** Running total of all task amounts within this billing period (decimal string). */
  readonly total_amount: string;
  /** Timestamp when the billing period was closed and an invoice was generated; `null` while still open. */
  readonly finalized_at: Date | null;
  /** Condensed invoice summary for this period; `null` when the period has not yet been finalized. */
  readonly invoice: IBillInvoiceSummaryResponse | null;
}
