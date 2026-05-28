/** snake_case JSON contract for a single task-review queue item. */
export interface ITaskReviewResponse {
  readonly id: string;
  readonly task_id: string;
  readonly task_code: string;
  readonly task_title: string;
  readonly project_id: string;
  readonly round_number: number;
  readonly is_arbiter: boolean;
  readonly decision: string;
  readonly assigned_at: Date;
  readonly voted_at: Date | null;
}

/** Detail view (the queue item plus the task body fields the reviewer needs to vote). */
export interface ITaskReviewDetailResponse extends ITaskReviewResponse {
  readonly task_description: Record<string, unknown> | null;
  readonly task_price: string;
  readonly task_consultant_payout: string;
  readonly task_assignee_id: string | null;
}
