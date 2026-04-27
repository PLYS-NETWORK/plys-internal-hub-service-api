import { ActivityType } from '@modules/unit-of-work/repositories';

export interface IActivityFeedRequest {
  /** 1-indexed page number. */
  page: number;
  /** Items per page (max 50). */
  pageSize: number;
  /** Optional category filter; absent ⇒ all categories. */
  types?: ActivityType[];
}
