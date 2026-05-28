export interface IBusinessTeamPerformanceItem {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
  active_projects_count: number;
  completed_tasks: number;
  in_progress_tasks: number;
  /** Mean cycle days over DONE tasks in window; `null` when none. */
  avg_cycle_days: string | null;
  /** `(on_time / total_done) * 100` one decimal; `null` when no qualifying rows. */
  on_time_pct: string | null;
}

export interface IBusinessTeamPerformanceResponse {
  consultants: IBusinessTeamPerformanceItem[];
  generated_at: string;
}
