import { BusinessActionItemsResponseDto } from '../../../dto/responses/business-action-items-response.dto';

/**
 * Contract for the business-dashboard "needs attention" queue. Returns the
 * top-5 items per category (tasks awaiting review, overdue tasks, open
 * disputes, overdue invoices, pending top-ups) plus the per-category total.
 */
export interface IBusinessActionItemsService {
  /**
   * Resolves the caller's business and aggregates the five action-item
   * categories in parallel. Cached 30 s per business.
   * @returns Populated action-items DTO.
   * @throws TranslatableException (403) — `BUSINESS_PROFILE_NOT_FOUND`.
   */
  get(): Promise<BusinessActionItemsResponseDto>;
}
