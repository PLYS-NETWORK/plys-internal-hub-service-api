import { AbstractRepository } from '@common/repositories';
import { TaskReview } from '@database/entities';
import { TaskReviewDecision } from '@database/enums';

/** Row shape used when bulk-creating reviewer assignments. */
export interface ICreateTaskReviewRow {
  taskId: string;
  reviewerId: string;
  roundNumber: number;
  isArbiter: boolean;
}

/** Aggregated vote counts for the active review round. */
export interface ITaskReviewDecisionTally {
  pass: number;
  fail: number;
  pending: number;
  recused: number;
}

export interface ITaskReviewRepository extends AbstractRepository<TaskReview> {
  /**
   * Bulk-creates pending review assignments for a task round.
   *
   * @param rows One row per reviewer (must include `is_arbiter` flag).
   * @returns The persisted rows in insertion order.
   */
  createBatch(rows: ICreateTaskReviewRow[]): Promise<TaskReview[]>;

  /**
   * Fetches all reviews for the given task scoped to one round number.
   * Used when re-evaluating the resolution rule after a vote arrives.
   */
  findByTaskAndRound(taskId: string, roundNumber: number): Promise<TaskReview[]>;

  /**
   * Reviewer's personal queue — reviews assigned to them that are still pending.
   * Sorted by `assigned_at ASC` (oldest first).
   *
   * @param reviewerId User id of the reviewer.
   * @param page       1-based page number.
   * @param take       Page size (caller-clamped to <=100).
   */
  findPendingByReviewerId(
    reviewerId: string,
    page: number,
    take: number,
  ): Promise<{ rows: TaskReview[]; total: number }>;

  /**
   * Fetches a single review by id with pessimistic write lock. Caller MUST be
   * inside a transaction. Used by the voting service to prevent two reviewers
   * resolving the round concurrently.
   *
   * @returns The locked row, or null when not found.
   */
  findByIdWithLock(reviewId: string): Promise<TaskReview | null>;

  /**
   * Fetches a single review by id (no lock). Returns a row joined with the
   * task and reviewer for the detail endpoint.
   */
  findByIdWithTask(reviewId: string): Promise<TaskReview | null>;

  /**
   * Records the reviewer's vote (sets `decision`, `feedback`, `voted_at = NOW()`).
   * Throws on any decision other than PASS / FAIL.
   *
   * @returns The updated review row.
   */
  recordVote(
    reviewId: string,
    decision: TaskReviewDecision,
    feedback: string | null,
  ): Promise<TaskReview>;

  /**
   * Counts the decisions for the given (task, round) tuple.
   *
   * @returns Tally with counts of pass / fail / pending / recused.
   */
  tallyDecisions(taskId: string, roundNumber: number): Promise<ITaskReviewDecisionTally>;

  /**
   * Marks all still-pending reviews of the given round as VOIDED. Used when a
   * task is cancelled or otherwise abandoned mid-review.
   *
   * @returns The number of voided rows.
   */
  voidPendingByTaskAndRound(taskId: string, roundNumber: number): Promise<number>;
}
