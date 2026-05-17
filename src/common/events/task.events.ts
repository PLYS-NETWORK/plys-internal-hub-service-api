export interface ITaskPublishedEvent {
  readonly task_id: string;
  readonly task_code: string;
  readonly task_title: string;
  readonly project_id: string;
  readonly project_code: string;
  readonly business_user_id: string;
  readonly business_name: string;
}

export interface ITaskStatusChangedEvent {
  readonly task_id: string;
  readonly task_code: string;
  readonly task_title: string;
  readonly project_id: string;
  readonly old_status: string;
  readonly new_status: string;
  /** The consultant who owns / is assigned to the task. */
  readonly consultant_user_id: string;
  /** The business owner of the project — required so handlers can fan out to them. */
  readonly business_user_id: string;
}
