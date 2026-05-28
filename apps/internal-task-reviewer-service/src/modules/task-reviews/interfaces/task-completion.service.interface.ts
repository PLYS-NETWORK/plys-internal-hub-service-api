export interface ITaskCompletionService {
  /**
   * Finalises a task as DONE inside a single DB transaction:
   *   1. Updates `kanban_status = done`, `completed_at = NOW()`, `approved_at = NOW()`.
   *   2. Inserts one `ConsultantTransaction` row of type `CREDIT_CLEARED`,
   *      `amount = task.consultantPayout`.
   *   3. Atomically increments `consultant_profiles.account_balance` by the
   *      same amount via a SQL `account_balance + :amount` update.
   *   4. Emits `TASK_STATUS_CHANGED` AFTER commit so subscribers run only on
   *      durable state.
   *
   * @param taskId Task currently in PENDING_APPROVAL (or IN_REVIEW for the
   *               no-AI path used by tests).
   * @throws TranslatableException(TASK_NOT_FOUND, 404) if the task is missing
   *         or in a status outside the allowed completion window.
   */
  markDone(taskId: string): Promise<void>;

  /**
   * Bounces a task back to REVISION_REQUESTED with consolidated feedback.
   * Increments `tasks.revision_count`; if the new count exceeds the cap (3),
   * opens a `TaskDispute` and parks the task in PENDING_APPROVAL for admin
   * adjudication instead of returning to the consultant.
   *
   * @param taskId         Task currently in IN_REVIEW or PENDING_APPROVAL.
   * @param feedbackSummary Consolidated feedback narrative (reviewer + AI).
   */
  markRevisionRequested(taskId: string, feedbackSummary: string): Promise<void>;
}
