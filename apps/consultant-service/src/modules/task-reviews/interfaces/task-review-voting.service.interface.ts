import { TaskReviewDecision } from '@plys/libraries/database/enums';

export interface ISubmitVoteParams {
  /** Reviewer's verdict — only PASS and FAIL are accepted; other values throw. */
  readonly decision: TaskReviewDecision.PASS | TaskReviewDecision.FAIL;
  /** Optional written rationale shown to the consultant on REVISION_REQUESTED. */
  readonly feedback?: string;
}

export interface ITaskReviewVotingService {
  /**
   * Records a reviewer's vote and re-evaluates the active round's resolution.
   *
   * Resolution rules:
   *   - 2 votes & both PASS → emit `TASK_AI_REVIEW_REQUESTED`, set task to PENDING_APPROVAL.
   *   - 2 votes & both FAIL → call completion service `markRevisionRequested` (no AI).
   *   - 2 votes & 1-1 split → assign Arbiter; task stays IN_REVIEW.
   *   - 3rd Arbiter vote arrives → ALWAYS `markRevisionRequested` (Arbiter's
   *     PASS/FAIL contributes feedback but cannot override the outcome).
   *
   * Concurrency: locks the task row pessimistically so only one vote resolves
   * the round even when reviewers submit simultaneously.
   *
   * @param reviewId Review row the caller is voting on.
   * @param params   Decision + optional feedback.
   * @throws TranslatableException(TASK_REVIEW_NOT_FOUND, 404) when missing.
   * @throws TranslatableException(TASK_REVIEW_FORBIDDEN, 403) when the caller
   *         is not the assigned reviewer.
   * @throws TranslatableException(TASK_REVIEW_ALREADY_VOTED, 409) on re-submit.
   * @throws TranslatableException(TASK_REVIEW_ROUND_CLOSED, 409) when the
   *         round has already resolved (task moved out of IN_REVIEW).
   */
  submitVote(reviewId: string, params: ISubmitVoteParams): Promise<void>;
}
