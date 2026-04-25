import { PageDto } from '@common/dto/page.dto';

import { ListBillsDto } from '../dto/requests/list-bills.dto';
import { TriggerSettlementDto } from '../dto/requests/trigger-settlement.dto';
import { BillDetailResponseDto } from '../dto/responses/bill-detail-response.dto';
import { BillListResponseDto } from '../dto/responses/bill-list-response.dto';
import { SendBillResponseDto } from '../dto/responses/send-bill-response.dto';

/**
 * Contract for all billing operations performed by an administrator.
 *
 * Every method reads administrative context from `RequestContextService`
 * internally; no caller identity is passed as a parameter.
 */
export interface IBillingAdminService {
  /**
   * Returns a paginated list of billing periods with their associated invoice
   * summary, optionally filtered by status and/or business ID.
   *
   * Each item includes the billing period details and a nested `invoice`
   * object (or `null` if no invoice has been generated yet for that period).
   *
   * @param dto - Pagination and filter parameters (`page`, `limit`, `status`,
   *              `businessId`).
   * @returns Paginated wrapper containing bill list DTOs and page metadata.
   */
  listBills(dto: ListBillsDto): Promise<PageDto<BillListResponseDto>>;

  /**
   * Manually triggers the settlement process for a given calendar month.
   *
   * Internally converts the 1-indexed `month` from the DTO to the 0-indexed
   * value expected by `BillingSettlementService.runSettlement`. When
   * `businessId` is provided only that business is settled; otherwise all
   * active businesses are processed.
   *
   * @param dto - Contains `year`, `month` (1–12), and an optional `businessId`.
   */
  triggerSettlement(dto: TriggerSettlementDto): Promise<void>;

  /**
   * Returns the full detail of a single invoice, including all line items
   * with task and project references.
   *
   * @param invoiceId - UUID of the invoice to retrieve.
   * @returns A `BillDetailResponseDto` containing the billing period and
   *          the nested invoice with its line items.
   * @throws TranslatableException (404) — invoice not found.
   */
  getBillDetail(invoiceId: string): Promise<BillDetailResponseDto>;

  /**
   * Sends (or re-sends) the invoice notification email to the business.
   *
   * If the invoice was already notified a warning is logged but the email is
   * still delivered. The `notifiedAt` timestamp on the invoice is updated
   * after a successful send.
   *
   * @param invoiceId - UUID of the invoice to email.
   * @returns A `SendBillResponseDto` with the invoice ID and the new
   *          `notified_at` timestamp.
   * @throws TranslatableException (404) — invoice not found.
   */
  sendBillEmail(invoiceId: string): Promise<SendBillResponseDto>;
}
