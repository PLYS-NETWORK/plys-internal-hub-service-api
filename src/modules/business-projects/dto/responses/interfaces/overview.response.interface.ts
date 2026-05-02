import {
  ProjectActivityEventType,
  ProjectMemberActiveStatus,
  ProjectPaymentType,
  ProjectStatus,
} from '@database/enums';

export interface IOverviewSummary {
  title: string;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  business_company_name: string;
  status: ProjectStatus;
  payment_type: ProjectPaymentType;
  /** Sum of price across all tasks (excluding cancelled). Pre-commission. */
  project_cost: string;
}

export interface IOverviewStatistics {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  total_project_members: number;
  total_pending_applications: number;
  total_applications: number;
  total_approved: number;
  total_rejected: number;
}

export interface IOverviewTaskStatuses {
  draft: number;
  to_do: number;
  assigned: number;
  in_progress: number;
  in_review: number;
  pending_approval: number;
  revision_requested: number;
  done: number;
  cancelled: number;
}

export interface IOverviewTeamMember {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
  active_status: ProjectMemberActiveStatus;
}

export interface IOverviewApplicationBreakdown {
  pending: number;
  accepted: number;
  rejected: number;
  withdrawn: number;
  /** accepted / (accepted + rejected) × 100, rounded; null when denominator = 0. */
  approval_rate: number | null;
}

export interface IOverviewActivityEvent {
  event_type: ProjectActivityEventType;
  event_id: string;
  occurred_at: Date;
  actor: { user_id: string | null; name: string | null };
  payload: Record<string, unknown>;
}

export interface IOverviewResponse {
  summary: IOverviewSummary;
  statistics: IOverviewStatistics;
  task_statuses: IOverviewTaskStatuses;
  team_members: IOverviewTeamMember[];
  application_breakdown: IOverviewApplicationBreakdown;
  recent_activity: IOverviewActivityEvent[];
}
