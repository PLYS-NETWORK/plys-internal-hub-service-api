import { BillingPeriodStatus, InvoiceStatus } from '@database/enums';

export interface IBillLineItemResponse {
  readonly id: string;
  readonly task_id: string;
  readonly task_title: string;
  readonly project_id: string;
  readonly project_title: string;
  readonly consultant_id: string;
  readonly description: string | null;
  readonly amount: string;
  readonly platform_fee_amount: string;
  readonly consultant_payout: string;
}

export interface IBillInvoiceDetailResponse {
  readonly id: string;
  readonly task_total: string;
  readonly commission_rate: string;
  readonly commission_amount: string;
  readonly amount: string;
  readonly currency: string;
  readonly status: InvoiceStatus;
  readonly due_date: string | null;
  readonly paid_at: Date | null;
  readonly notified_at: Date | null;
  readonly processor_name: string | null;
  readonly processor_payment_url: string | null;
  readonly line_items: IBillLineItemResponse[];
}

export interface IBillDetailResponse {
  readonly id: string;
  readonly business_id: string;
  readonly period_start: string;
  readonly period_end: string;
  readonly status: BillingPeriodStatus;
  readonly total_amount: string;
  readonly finalized_at: Date | null;
  readonly invoice: IBillInvoiceDetailResponse | null;
}
