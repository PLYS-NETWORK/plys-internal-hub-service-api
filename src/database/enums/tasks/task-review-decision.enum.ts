export enum TaskReviewDecision {
  PENDING = 'pending',
  PASS = 'pass',
  FAIL = 'fail',
  RECUSED = 'recused',
  VOIDED = 'voided',
}

export const TASK_REVIEW_DECISIONS: readonly TaskReviewDecision[] = [
  TaskReviewDecision.PENDING,
  TaskReviewDecision.PASS,
  TaskReviewDecision.FAIL,
  TaskReviewDecision.RECUSED,
  TaskReviewDecision.VOIDED,
];
