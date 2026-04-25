import { PageDto } from '@common/dto/page.dto';

import { CreateTopUpDto } from '../../dto/requests/create-top-up.dto';
import { ListBusinessTransactionsDto } from '../../dto/requests/list-business-transactions.dto';
import { SettleInvoiceDto } from '../../dto/requests/settle-invoice.dto';
import {
  SettleInvoiceResponseDto,
  TopUpResponseDto,
  TransactionResponseDto,
} from '../../dto/responses';

/**
 * Contract for payment operations performed by a business user.
 *
 * Caller identity is resolved internally via `RequestContextService` — no
 * `userId` or `businessId` is accepted as a parameter.
 */
export interface IBusinessPaymentsService {
  /**
   * Initiates a wallet top-up by creating a pending `BusinessTransaction` and
   * opening a hosted checkout session via the active payment provider.
   *
   * On success, returns the redirect URL the frontend must navigate the user to.
   * The transaction is marked `COMPLETED` asynchronously by the webhook handler
   * once the payment processor confirms receipt.
   *
   * @param dto - Contains `amount` (USD), `successUrl`, and `cancelUrl`.
   * @returns DTO with `transaction_id` and the processor's `redirect_url`.
   * @throws TranslatableException (404) — business profile not found for caller.
   * @throws TranslatableException (500) — payment provider failed to create session.
   */
  createTopUp(dto: CreateTopUpDto): Promise<TopUpResponseDto>;

  /**
   * Initiates payment for an outstanding invoice by opening a hosted checkout
   * session linked to the invoice. The invoice must be unpaid and owned by the
   * calling business.
   *
   * Processor IDs are saved on the invoice row for reconciliation. The invoice
   * status is updated to `PAID` asynchronously by the webhook handler.
   *
   * @param dto - Contains `invoiceId`, `successUrl`, and `cancelUrl`.
   * @returns DTO with `invoice_id` and the processor's `redirect_url`.
   * @throws TranslatableException (404) — business profile or invoice not found.
   * @throws TranslatableException (403) — invoice does not belong to calling business.
   * @throws TranslatableException (409) — invoice is already paid.
   * @throws TranslatableException (500) — payment provider failed to create session.
   */
  settleInvoice(dto: SettleInvoiceDto): Promise<SettleInvoiceResponseDto>;

  /**
   * Returns a paginated, reverse-chronological list of business transactions
   * for the calling business. Supports optional filtering by `type` and `status`.
   *
   * @param dto - Pagination options plus optional `type` and `status` filters.
   * @returns Paginated wrapper containing transaction DTOs and page metadata.
   * @throws TranslatableException (404) — business profile not found for caller.
   */
  listTransactions(dto: ListBusinessTransactionsDto): Promise<PageDto<TransactionResponseDto>>;
}
