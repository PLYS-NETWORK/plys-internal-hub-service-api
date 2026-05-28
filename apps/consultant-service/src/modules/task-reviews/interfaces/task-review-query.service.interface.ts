import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PageOptionsDto } from '@plys/libraries/common-nest/dto/page-options.dto';

import { TaskReviewDetailResponseDto } from '../dto/responses/task-review-detail-response.dto';
import { TaskReviewResponseDto } from '../dto/responses/task-review-response.dto';

export interface ITaskReviewQueryService {
  /**
   * Returns the caller's pending review queue. Caller MUST have role
   * TASK_REVIEWER — admins reading the queue see an empty page because no
   * reviews are assigned to them by `pickEligibleReviewers`.
   *
   * @param pageOptions Pagination filters (page, limit).
   */
  listPending(pageOptions: PageOptionsDto): Promise<PageDto<TaskReviewResponseDto>>;

  /**
   * Returns one review row plus the task fields the reviewer needs to vote.
   *
   * @param reviewId Review row id.
   * @throws TranslatableException(TASK_REVIEW_NOT_FOUND, 404) when missing.
   * @throws TranslatableException(TASK_REVIEW_FORBIDDEN, 403) when the caller
   *         is a TASK_REVIEWER but does not own this review. ADMIN_PLATFORM
   *         callers may read any row for oversight.
   */
  getDetail(reviewId: string): Promise<TaskReviewDetailResponseDto>;
}
