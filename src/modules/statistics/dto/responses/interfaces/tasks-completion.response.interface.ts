export interface ITasksCompletionItem {
  project_id: string;
  project_name: string;
  total_tasks: number;
  completed_tasks: number;
  /** `completed_tasks / total_tasks`; `0` when total_tasks = 0. */
  completion_rate: number;
}

export interface ITasksCompletionResponse {
  /** Per-project completion rates, sorted by completion_rate desc. */
  projects: ITasksCompletionItem[];
}
