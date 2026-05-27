import { ProjectPaymentType, ProjectStatus } from '@plys/libraries/database/enums';

export interface IBusinessProjectHealthItem {
  project_id: string;
  code: string;
  title: string;
  status: ProjectStatus;
  payment_type: ProjectPaymentType;
  total_tasks: number;
  completed_tasks: number;
  in_review_tasks: number;
  overdue_tasks: number;
  /** `(completed / total) * 100` one decimal; `null` when `total = 0`. */
  completion_pct: string | null;
  /** Sum of completed outflow `total_amount` on this project for the current month-to-date. */
  mtd_spend: string;
  /** Latest `task.updated_at` across the project; `null` when no tasks. */
  last_activity_at: string | null;
  /** Risk flag — overdue_tasks > 0 OR (in_review_tasks > 0 AND oldest_in_review > 7d ago). */
  is_at_risk: boolean;
}

export interface IBusinessProjectHealthResponse {
  projects: IBusinessProjectHealthItem[];
  generated_at: string;
}
