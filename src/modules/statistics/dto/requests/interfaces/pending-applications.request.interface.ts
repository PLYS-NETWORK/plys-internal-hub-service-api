export interface IPendingApplicationsRequest {
  /** 1-indexed page number. */
  page: number;
  /** Items per page (max 100). */
  pageSize: number;
}
