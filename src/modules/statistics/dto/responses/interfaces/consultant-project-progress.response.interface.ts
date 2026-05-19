import { ProjectPaymentType, ProjectStatus } from '@database/enums';

export interface IConsultantProjectProgressItem {
  project_id: string;
  code: string;
  title: string;
  status: ProjectStatus;
  payment_type: ProjectPaymentType;
  joined_at: string;
  /** Total tasks currently assigned to the caller in this project. */
  my_assigned_tasks: number;
  my_in_progress_tasks: number;
  my_in_review_tasks: number;
  my_completed_tasks: number;
  my_overdue_tasks: number;
  my_revision_requested_tasks: number;
  /** `(my_completed / (my_completed + my_assigned)) * 100`; `null` when neither. */
  my_completion_pct: string | null;
  /** Sum of CREDIT_CLEARED rows the caller has earned on this project. */
  my_earnings_in_project: string;
  /** Latest `task.updated_at` across the caller's tasks in this project. */
  last_activity_at: string | null;
  /** True if any overdue OR revision-requested tasks are present. */
  is_at_risk: boolean;
}

export interface IConsultantProjectProgressResponse {
  projects: IConsultantProjectProgressItem[];
  generated_at: string;
}
