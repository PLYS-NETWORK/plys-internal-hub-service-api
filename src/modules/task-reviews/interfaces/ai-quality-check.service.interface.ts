/** Outcome of an AI quality check on a task submission. */
export interface IAiQualityCheckResult {
  /**
   * `pass`: AI is confident the deliverable meets the task's success criteria.
   * `fail`: AI flagged issues; the task should bounce back to REVISION_REQUESTED.
   */
  readonly decision: 'pass' | 'fail';
  /** Optional plain-text narrative shown to the consultant on FAIL. */
  readonly feedback?: string;
}

/** Inputs for {@link IAiQualityCheckService.evaluate}. */
export interface IAiQualityCheckParams {
  /** Task currently in PENDING_APPROVAL awaiting AI gate. */
  readonly taskId: string;
  /** Review round being evaluated — used for idempotency by the caller. */
  readonly roundNumber: number;
}

export interface IAiQualityCheckService {
  /**
   * Runs the AI quality gate on a task that has already cleared the human
   * reviewers (majority PASS). The current stub always returns `pass`; the
   * real implementation will pull the task's deliverable, send it to the
   * provider (LLM / CopyLeaks), and translate the response.
   *
   * @param params Task id and round number being evaluated.
   * @returns Decision and optional feedback narrative for REVISION_REQUESTED.
   * @throws Error if the provider fails — caller surfaces FAIL with feedback.
   */
  evaluate(params: IAiQualityCheckParams): Promise<IAiQualityCheckResult>;
}
