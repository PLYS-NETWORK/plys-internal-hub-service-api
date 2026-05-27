import { BusinessTransactionType, TransactionStatus } from '@plys/libraries/database/enums';

import { IAdminTransactionOwnerResponse } from './admin-transaction-owner.response.interface';
import { IPayerInfoResponse } from './payer-info.response.interface';

/**
 * Admin-facing business transaction row.
 *
 * Mirrors [[transaction.response.interface]] with two additions:
 * `transaction_number` (support lookups) and `owner` (so admins can attribute
 * the row without a second call).
 */
export interface IAdminBusinessTransactionResponse {
  /** UUID of the business transaction record. */
  id: string;
  /** Human-facing transaction number (`PLS[SHORT_TYPE][YYYYMMDD][N]`). */
  transaction_number: string;
  /** Transaction kind (e.g. `top_up`, `monthly_billing`, `refund`). */
  type: BusinessTransactionType;
  /** Decimal string base/subtotal amount before commission. */
  amount: string;
  /** Decimal string commission rate snapshot; `null` when commission does not apply. */
  commission_rate: string | null;
  /** Decimal string commission amount; `null` when commission does not apply. */
  commission_amount: string | null;
  /** Decimal string total charged = amount + commission_amount. */
  total_amount: string;
  /** Current processing status of the transaction. */
  status: TransactionStatus;
  /** Optional human-readable note attached to the transaction; `null` when absent. */
  note: string | null;
  /** Payer information snapshot captured at checkout creation; `null` for internal ledger entries. */
  payer_info: IPayerInfoResponse | null;
  /** ISO 8601 timestamp in the caller's resolved timezone (with offset). */
  created_at: string;
  /** Identifying information about the business that owns the row. */
  owner: IAdminTransactionOwnerResponse;
}
