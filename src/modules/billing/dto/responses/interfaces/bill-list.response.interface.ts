import { BillingPeriodStatus, InvoiceStatus } from '@database/enums';

export interface IBillInvoiceSummaryResponse {
  readonly id: string;
  readonly amount: string;
  readonly currency: string;
  readonly status: InvoiceStatus;
  readonly due_date: string | null;
  readonly paid_at: Date | null;
}

export interface IBillListResponse {
  readonly id: string;
  readonly business_id: string;
  readonly period_start: string;
  readonly period_end: string;
  readonly status: BillingPeriodStatus;
  readonly total_amount: string;
  readonly finalized_at: Date | null;
  readonly invoice: IBillInvoiceSummaryResponse | null;
}
