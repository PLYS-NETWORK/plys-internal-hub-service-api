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
  /** Optional enrichment from the 3+1 review workflow — present on DONE/REVISION transitions. */
  readonly earned_amount?: string;
  readonly feedback_summary?: string;
  readonly revision_count?: number;
  readonly revisions_remaining?: number;
}

/** Emitted when a reviewer is auto-assigned to a task (initial slot or arbiter). */
export interface ITaskReviewerReviewAssignedEvent {
  readonly review_id: string;
  readonly task_id: string;
  readonly task_code: string;
  readonly task_title: string;
  readonly project_id: string;
  readonly round_number: number;
  readonly is_arbiter: boolean;
  /** User id of the reviewer to notify. */
  readonly reviewer_user_id: string;
}

/**
 * Emitted after a majority-PASS resolution so the AI quality check can run
 * asynchronously and decide DONE vs REVISION_REQUESTED. Idempotency-keyed on
 * (task_id, round_number) by the handler.
 */
export interface ITaskAiReviewRequestedEvent {
  readonly task_id: string;
  readonly round_number: number;
}
