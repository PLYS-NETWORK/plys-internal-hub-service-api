export interface IConsultantActionTaskItem {
  task_id: string;
  task_code: string;
  title: string;
  project_id: string;
  project_title: string;
  kanban_status: string;
}

export interface IConsultantActionRevisionTaskItem extends IConsultantActionTaskItem {
  /** Due date if set on the task. */
  due_date: string | null;
  /** Timestamp the task was last bounced back for revision (most recent transition). */
  last_revision_requested_at: string;
}

export interface IConsultantActionOverdueTaskItem extends IConsultantActionTaskItem {
  due_date: string;
  days_overdue: number;
}

export interface IConsultantActionPendingApprovalTaskItem extends IConsultantActionTaskItem {
  /** Timestamp the task was last submitted for review. */
  submitted_at: string;
  /** Whole days since the task entered review. */
  days_waiting: number;
}

export interface IConsultantActionNotificationItem {
  notification_id: string;
  type: string;
  title: string;
  body: string;
  redirect_url: string | null;
  created_at: string;
}

export interface IConsultantActionPendingWithdrawalItem {
  transaction_id: string;
  transaction_number: string;
  amount: string;
  withdrawal_method: string | null;
  created_at: string;
}

export interface IConsultantActionCategory<T> {
  total: number;
  items: T[];
}

export interface IConsultantActionItemsResponse {
  revision_requested_tasks: IConsultantActionCategory<IConsultantActionRevisionTaskItem>;
  overdue_tasks: IConsultantActionCategory<IConsultantActionOverdueTaskItem>;
  pending_approval_tasks: IConsultantActionCategory<IConsultantActionPendingApprovalTaskItem>;
  recent_notifications: IConsultantActionCategory<IConsultantActionNotificationItem>;
  pending_withdrawals: IConsultantActionCategory<IConsultantActionPendingWithdrawalItem>;
  generated_at: string;
}
