import { TaskReviewDecision } from '@database/enums';

/** camelCase TS-internal shape of the vote submission body. */
export interface ISubmitVoteRequest {
  readonly decision: TaskReviewDecision.PASS | TaskReviewDecision.FAIL;
  readonly feedback?: string;
}
