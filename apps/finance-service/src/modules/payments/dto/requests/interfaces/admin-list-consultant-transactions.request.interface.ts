import { Order } from '@plys/libraries/common-nest/dto/page-options.dto';
import { ConsultantTransactionType, TransactionStatus } from '@plys/libraries/database/enums';

/**
 * Admin filter shape for listing consultant transactions across all consultants.
 *
 * Property names are camelCase — this is the TS-internal shape after
 * class-transformer maps the snake_case query keys (e.g. `consultant_id`)
 * declared on the DTO via `@Expose({ name: 'snake_key' })`.
 */
export interface IAdminListConsultantTransactionsRequest {
  /** 1-based page number. */
  page: number;
  /** Page size (1..100). */
  limit: number;
  /** Optional column name to sort by (entity-specific whitelist). */
  sort_by?: string;
  /** Optional sort direction. */
  order_by?: Order;
  /** Optional consultant transaction type filter. */
  type?: ConsultantTransactionType;
  /** Optional processing status filter. */
  status?: TransactionStatus;
  /** Optional consultant profile UUID to scope the result to one consultant's ledger. */
  consultantId?: string;
  /** Optional inclusive lower bound on `createdAt` (ISO 8601 input → Date). */
  createdFrom?: Date;
  /** Optional inclusive upper bound on `createdAt` (ISO 8601 input → Date). */
  createdTo?: Date;
}
