/** Query-shape contract for `GET /admin/task-reviews/pending` — pagination only. */
export interface IListPendingReviewsRequest {
  readonly page: number;
  readonly limit: number;
}
