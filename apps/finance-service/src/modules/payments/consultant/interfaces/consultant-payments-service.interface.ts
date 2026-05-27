import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';

import { ListConsultantTransactionsDto } from '../../dto/requests/list-consultant-transactions.dto';
import { ConsultantTransactionResponseDto } from '../../dto/responses';

/**
 * Contract for payment operations performed by a consultant user.
 *
 * Caller identity is resolved internally via `RequestContextService` — no
 * `userId` or `consultantId` is accepted as a parameter.
 */
export interface IConsultantPaymentsService {
  /**
   * Returns a paginated, reverse-chronological list of transactions for the
   * calling consultant. Supports optional filtering by `type` and `status`.
   *
   * @param dto - Pagination options plus optional `type` and `status` filters.
   * @returns Paginated wrapper containing consultant transaction DTOs and page metadata.
   * @throws TranslatableException (404) — consultant profile not found for caller.
   */
  listTransactions(
    dto: ListConsultantTransactionsDto,
  ): Promise<PageDto<ConsultantTransactionResponseDto>>;
}
