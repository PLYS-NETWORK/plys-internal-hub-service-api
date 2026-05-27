export interface IBusinessDashboardMoney {
  currency: string;
  wallet_balance: string;
  mtd_spend: string;
  projected_monthly_bill: string;
  outstanding_invoices_amount: string;
  outstanding_invoices_count: number;
  unpublished_pipeline_value: string;
}

export interface IBusinessDashboardPortfolio {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  /** Active projects with at least one overdue task. */
  at_risk_count: number;
}

export interface IBusinessDashboardThroughput {
  tasks_completed_mtd: number;
  tasks_in_review: number;
  tasks_overdue: number;
  /** Mean cycle days over DONE tasks in MTD; `null` when none. */
  avg_cycle_days: string | null;
  /** `(on_time / total_done) * 100` over MTD; `null` when no qualifying rows. */
  on_time_delivery_pct: string | null;
}

export interface IBusinessDashboardTeam {
  active_consultants: number;
  new_consultants_mtd: number;
}

export interface IBusinessDashboardActionCounts {
  tasks_awaiting_review: number;
  overdue_tasks: number;
  open_disputes: number;
  overdue_invoices: number;
  pending_topups: number;
}

export interface IBusinessDashboardSummaryResponse {
  money: IBusinessDashboardMoney;
  portfolio: IBusinessDashboardPortfolio;
  throughput: IBusinessDashboardThroughput;
  team: IBusinessDashboardTeam;
  action_counts: IBusinessDashboardActionCounts;
  generated_at: string;
}
