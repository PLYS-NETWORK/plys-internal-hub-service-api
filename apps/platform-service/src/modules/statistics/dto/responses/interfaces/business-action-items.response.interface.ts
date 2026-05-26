export interface IBusinessActionTaskItem {
  task_id: string;
  task_code: string;
  title: string;
  project_id: string;
  project_title: string;
  submitted_at: string;
}

export interface IBusinessActionOverdueTaskItem extends IBusinessActionTaskItem {
  due_date: string;
  days_overdue: number;
}

export interface IBusinessActionDisputeItem {
  dispute_id: string;
  task_id: string;
  task_code: string;
  reason_snippet: string;
  opened_at: string;
}

export interface IBusinessActionOverdueInvoiceItem {
  invoice_id: string;
  amount: string;
  due_date: string;
  days_overdue: number;
}

export interface IBusinessActionPendingTopUpItem {
  transaction_id: string;
  transaction_number: string;
  total_amount: string;
  created_at: string;
  /** Polar checkout URL; `null` until the SPA calls the `continue` endpoint. */
  redirect_url: string | null;
}

export interface IBusinessActionCategory<T> {
  total: number;
  items: T[];
}

export interface IBusinessActionItemsResponse {
  tasks_awaiting_review: IBusinessActionCategory<IBusinessActionTaskItem>;
  overdue_tasks: IBusinessActionCategory<IBusinessActionOverdueTaskItem>;
  open_disputes: IBusinessActionCategory<IBusinessActionDisputeItem>;
  overdue_invoices: IBusinessActionCategory<IBusinessActionOverdueInvoiceItem>;
  pending_topups: IBusinessActionCategory<IBusinessActionPendingTopUpItem>;
  generated_at: string;
}
