import {
  ProficiencyLevel,
  ProjectActivityEventType,
  ProjectMemberActiveStatus,
  ProjectPaymentType,
  ProjectStatus,
} from '@plys/libraries/database/enums';

/** Project header. Lifecycle timestamps stay UTC ISO; FE handles tz on render. */
export interface IOverviewSummary {
  id: string;
  code: string;
  title: string;
  status: ProjectStatus;
  payment_type: ProjectPaymentType;
  business_company_name: string;
  required_consultants: number;
  created_at: string;
  published_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

/** Owner's "how is this project doing right now" block. */
export interface IOverviewHealth {
  total_tasks: number;
  completed_tasks: number;
  in_review_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  /** `(completed / total) * 100`, one decimal. `null` when `total = 0`. */
  completion_pct: string | null;
  tasks_completed_last_7d: number;
  open_disputes: number;
  /** `overdue_tasks > 0` OR `(in_review > 0 AND oldest_in_review > 7d)`. */
  is_at_risk: boolean;
  last_activity_at: string | null;
}

/** Money flowing through this project. All amounts are decimal strings. */
export interface IOverviewMoney {
  currency: string;
  spent_on_publish: string;
  spent_on_tasks: string;
  total_spent: string;
  unpublished_pipeline_value: string;
  /** PER_MONTH projects only; `null` when payment_type = PER_TASK. */
  projected_monthly_bill: string | null;
}

/** One skill on a consultant, optionally flagged as required by this project. */
export interface IOverviewTeamSkill {
  skill_id: string;
  /** i18n key from `skills.name` (e.g. `skill_react`). FE translates. */
  skill_name: string;
  proficiency_level: ProficiencyLevel | null;
  /** 0–100 decimal string from the latest passing exam; `null` when no rating. */
  rating: string | null;
  /** `true` when this skill is in `project_required_skills` for the project. */
  is_required: boolean;
}

/** One team-member row in the project overview. */
export interface IOverviewTeamMember {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
  active_status: ProjectMemberActiveStatus;
  joined_at: string;
  completed_tasks: number;
  in_progress_tasks: number;
  avg_cycle_days: string | null;
  on_time_pct: string | null;
  skills: IOverviewTeamSkill[];
}

/** Action-item categories scoped to this project (top-5 items each). */
export interface IOverviewActionItemTask {
  task_id: string;
  task_code: string;
  title: string;
  reference_at: string;
  /** Integer days past `due_date`, only present for overdue items. */
  days_overdue: number | null;
}

export interface IOverviewActionItemDispute {
  dispute_id: string;
  task_id: string;
  task_code: string;
  reason_snippet: string;
  opened_at: string;
}

export interface IOverviewActionCategory<T> {
  total: number;
  items: T[];
}

export interface IOverviewActionItems {
  tasks_awaiting_review: IOverviewActionCategory<IOverviewActionItemTask>;
  overdue_tasks: IOverviewActionCategory<IOverviewActionItemTask>;
  open_disputes: IOverviewActionCategory<IOverviewActionItemDispute>;
}

/** Same shape as today. */
export interface IOverviewActivityEvent {
  event_type: ProjectActivityEventType;
  event_id: string;
  occurred_at: Date;
  actor: { user_id: string | null; name: string | null };
  payload: Record<string, unknown>;
}

export interface IOverviewResponse {
  summary: IOverviewSummary;
  health: IOverviewHealth;
  money: IOverviewMoney;
  team: IOverviewTeamMember[];
  action_items: IOverviewActionItems;
  activity: IOverviewActivityEvent[];
  generated_at: string;
}
