import { Order } from '@common/dto/page-options.dto';
import { BusinessTransactionType, TransactionStatus } from '@database/enums';

/**
 * Admin filter shape for listing business transactions across all businesses.
 *
 * Property names are camelCase — this is the TS-internal shape after
 * class-transformer maps the snake_case query keys (e.g. `business_id`)
 * declared on the DTO via `@Expose({ name: 'snake_key' })`.
 */
export interface IAdminListBusinessTransactionsRequest {
  /** 1-based page number. */
  page: number;
  /** Page size (1..100). */
  limit: number;
  /** Optional column name to sort by (entity-specific whitelist). */
  sort_by?: string;
  /** Optional sort direction. */
  order_by?: Order;
  /** Optional business transaction type filter. */
  type?: BusinessTransactionType;
  /** Optional processing status filter. */
  status?: TransactionStatus;
  /** Optional business profile UUID to scope the result to one business's ledger. */
  businessId?: string;
  /** Optional inclusive lower bound on `createdAt` (ISO 8601 input → Date). */
  createdFrom?: Date;
  /** Optional inclusive upper bound on `createdAt` (ISO 8601 input → Date). */
  createdTo?: Date;
}
