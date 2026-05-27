import { BillingPeriodStatus, InvoiceStatus } from '@plys/libraries/database/enums';

export interface IBillLineItemResponse {
  /** UUID of the invoice line-item record. */
  readonly id: string;
  /** UUID of the completed task that generated this line item. */
  readonly task_id: string;
  /** Human-readable title of the completed task. */
  readonly task_title: string;
  /** UUID of the project the task belongs to. */
  readonly project_id: string;
  /** Human-readable title of the project the task belongs to. */
  readonly project_title: string;
  /** UUID of the consultant who completed the task. */
  readonly consultant_id: string;
  /** Optional description of the work performed; `null` when not provided. */
  readonly description: string | null;
  /** Total amount charged to the business for this line item (decimal string). */
  readonly amount: string;
  /** Platform fee portion of the line-item amount (decimal string). */
  readonly platform_fee_amount: string;
  /** Net amount paid out to the consultant for this line item (decimal string). */
  readonly consultant_payout: string;
}

export interface IBillInvoiceDetailResponse {
  /** UUID of the invoice record. */
  readonly id: string;
  /** Sum of all line-item amounts before commission is applied (decimal string). */
  readonly task_total: string;
  /** Commission rate as a decimal, e.g. `"0.2500"` for 25%. */
  readonly commission_rate: string;
  /** Commission amount = task_total × commission_rate (decimal string). */
  readonly commission_amount: string;
  /** Total invoice amount = task_total + commission_amount (decimal string). */
  readonly amount: string;
  /** ISO 4217 currency code for the invoice (e.g. `"USD"`). */
  readonly currency: string;
  /** Current payment status of the invoice (e.g. `pending`, `paid`, `overdue`). */
  readonly status: InvoiceStatus;
  /** ISO 8601 date string of the payment due date; `null` when not yet set. */
  readonly due_date: string | null;
  /** Timestamp when the invoice was paid; `null` until payment is confirmed. */
  readonly paid_at: Date | null;
  /** Timestamp when the business was notified about this invoice; `null` until notified. */
  readonly notified_at: Date | null;
  /** Name of the payment processor used (e.g. `"Polar"`); `null` when not yet assigned. */
  readonly processor_name: string | null;
  /** URL for the payment processor's hosted payment page; `null` when not yet generated. */
  readonly processor_payment_url: string | null;
  /** Ordered list of completed-task line items included in this invoice. */
  readonly line_items: IBillLineItemResponse[];
}

export interface IBillDetailResponse {
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
  /** Full invoice detail for this period; `null` when the period has not yet been finalized. */
  readonly invoice: IBillInvoiceDetailResponse | null;
}
