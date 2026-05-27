export interface ITaskReviewAssignmentService {
  /**
   * Auto-assigns 2 initial reviewers when a task enters IN_REVIEW. The caller
   * is responsible for incrementing `tasks.last_review_round` BEFORE invoking
   * this method so the inserted rows carry the correct round number. Reviewer
   * selection excludes the task assignee, project members, and any user with
   * a still-pending review for an earlier round of the same task.
   *
   * @param taskId Task currently in IN_REVIEW.
   * @throws TranslatableException(TASK_REVIEW_INSUFFICIENT_REVIEWERS, 503) when
   *         the eligible-reviewer pool is too small.
   */
  assignInitialReviewers(taskId: string): Promise<void>;

  /**
   * Assigns a single Arbiter (3rd reviewer) when the first two reviewers split
   * 1-1. The Arbiter's vote contributes feedback only — any 1-1 split always
   * resolves to REVISION_REQUESTED.
   *
   * @param taskId      Task whose round is awaiting a tie-breaker.
   * @param roundNumber The current `tasks.last_review_round` value.
   * @throws TranslatableException(TASK_REVIEW_INSUFFICIENT_REVIEWERS, 503) when
   *         no eligible reviewer remains.
   */
  assignArbiter(taskId: string, roundNumber: number): Promise<void>;

  /**
   * Voids every pending review row for the given (task, round) tuple. Called
   * on task cancellation or admin reset so reviewers stop seeing a dead task
   * in their queue.
   *
   * @returns The number of pending rows transitioned to VOIDED.
   */
  voidActiveReviews(taskId: string, roundNumber: number): Promise<number>;
}
