import { ProjectPaymentType, ProjectStatus, TaskKanbanStatus } from '@database/enums';

export interface IConsultantOverviewProject {
  id: string;
  title: string;
  payment_type: ProjectPaymentType;
  status: ProjectStatus;
  started_at: Date | null;
  /** Always null until a deadline column is introduced. */
  days_remaining: null;
}

export interface IConsultantOverviewConsultant {
  id: string;
  full_name: string;
  avatar_url: string | null;
  joined_at: Date;
}

/** Counts indexed by `kanban_status` (plus a catch-all `total`). */
export type IConsultantOverviewByStatus = Partial<Record<TaskKanbanStatus, number>>;

export interface IConsultantOverviewProgress {
  by_status: IConsultantOverviewByStatus;
  total_assigned: number;
  /** 0–1, two decimal places. Zero when no tasks are assigned. */
  completion_rate: number;
}

export interface IConsultantOverviewCompletedTask {
  id: string;
  task_id: string | null;
  task_code: string | null;
  task_name: string | null;
  amount: number;
}

export interface IConsultantOverviewPaymentHistoryItem {
  id: string;
  transaction_number: string;
  amount: number;
  status: string;
  paid_at: Date;
  period_start: string | null;
  period_end: string | null;
}

export interface IConsultantOverviewEarnings {
  total_earned: number;
  currency: string;
  /** Present only for PER_TASK projects. */
  pending_amount?: number;
  /** Present only for PER_TASK projects. */
  completed_tasks?: IConsultantOverviewCompletedTask[];
  /** Present only for PER_MONTH projects. */
  payment_history?: IConsultantOverviewPaymentHistoryItem[];
}

export interface IConsultantOverviewNextPayment {
  /** ISO date for the upcoming pay-out (5th of next month). */
  date: Date;
  days_until: number;
  /** Best-known monthly amount (last paid amount, else 0). */
  amount: number;
  currency: string;
  last_paid_at: Date | null;
}

export interface IConsultantOverviewResponse {
  project: IConsultantOverviewProject;
  consultant: IConsultantOverviewConsultant;
  progress: IConsultantOverviewProgress;
  earnings: IConsultantOverviewEarnings;
  /** PER_MONTH projects only. */
  next_payment?: IConsultantOverviewNextPayment;
}
