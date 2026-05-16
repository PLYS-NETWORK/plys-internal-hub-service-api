import { PageDto } from '@common/dto/page.dto';

import { AdminListBusinessTransactionsDto } from '../../dto/requests/admin-list-business-transactions.dto';
import { AdminListConsultantTransactionsDto } from '../../dto/requests/admin-list-consultant-transactions.dto';
import {
  AdminBusinessTransactionResponseDto,
  AdminConsultantTransactionResponseDto,
} from '../../dto/responses';

/**
 * Contract for admin-only payment operations.
 *
 * These endpoints are scoped to `UserRole.ADMIN_PLATFORM` at the controller
 * level and intentionally do NOT filter by the caller's profile — admins
 * inspect ledgers across all consultants and businesses.
 */
export interface IAdminPaymentsService {
  /**
   * Returns a paginated, reverse-chronological list of consultant transactions
   * across all consultants. Supports optional filters by `type`, `status`,
   * `consultantId`, and `createdAt` range. Each row includes an embedded
   * `owner` block (consultant `full_name` + user email) so admins can attribute
   * rows without a follow-up call.
   *
   * @param dto - Pagination options plus optional filters.
   * @returns Paginated wrapper containing admin consultant transaction DTOs and page metadata.
   */
  listConsultantTransactions(
    dto: AdminListConsultantTransactionsDto,
  ): Promise<PageDto<AdminConsultantTransactionResponseDto>>;

  /**
   * Returns a paginated, reverse-chronological list of business transactions
   * across all businesses. Supports optional filters by `type`, `status`,
   * `businessId`, and `createdAt` range. Each row includes an embedded
   * `owner` block (business `company_name` + user email) so admins can attribute
   * rows without a follow-up call.
   *
   * `created_at` is rendered in the admin caller's resolved timezone, matching
   * the user-facing business endpoint.
   *
   * @param dto - Pagination options plus optional filters.
   * @returns Paginated wrapper containing admin business transaction DTOs and page metadata.
   */
  listBusinessTransactions(
    dto: AdminListBusinessTransactionsDto,
  ): Promise<PageDto<AdminBusinessTransactionResponseDto>>;
}
