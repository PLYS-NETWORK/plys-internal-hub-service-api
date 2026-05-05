export interface IDashboardSummaryProjects {
  total: number;
  published: number;
  draft: number;
}

export interface IDashboardSummaryTasks {
  total_open: number;
  overdue_count: number;
}

export interface IDashboardSummaryBilling {
  total_spend: string;
  currency: string;
}

export interface IDashboardSummaryResponse {
  projects: IDashboardSummaryProjects;
  tasks: IDashboardSummaryTasks;
  billing: IDashboardSummaryBilling;
  /** Server-side timestamp when the summary was computed. */
  generated_at: Date;
}
