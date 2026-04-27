export interface ITasksOverdueByProject {
  project_id: string;
  project_name: string;
  overdue_count: number;
}

export interface ITasksOverdueResponse {
  /** Total overdue tasks across all projects. */
  overdue_count: number;
  /** Per-project breakdown sorted by overdue_count desc. Projects with zero overdue are omitted. */
  by_project: ITasksOverdueByProject[];
}
