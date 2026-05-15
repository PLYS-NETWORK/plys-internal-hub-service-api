import { ConsultantTransactionType, TransactionStatus } from '@database/enums';

import { IAdminTransactionOwnerResponse } from './admin-transaction-owner.response.interface';

/**
 * Admin-facing consultant transaction row.
 *
 * Identical to the user-facing shape ([[consultant-transaction.response.interface]])
 * with two additions: `transaction_number` (operations need it for support
 * lookups) and `owner` (so admins can attribute the row without a second call).
 */
export interface IAdminConsultantTransactionResponse {
  /** UUID of the consultant transaction record. */
  id: string;
  /** Human-facing transaction number (`LN[SHORT_TYPE][YYYYMMDD][N]`). */
  transaction_number: string;
  /** Transaction kind (e.g. `withdrawal`, `credit_cleared`). */
  type: ConsultantTransactionType;
  /** Decimal string consultant payout amount (after platform fee). */
  amount: string;
  /** Decimal string commission rate snapshot. */
  commission_rate: string;
  /** Decimal string commission amount withheld. */
  commission_amount: string;
  /** Decimal string gross amount = amount + commission_amount. */
  total_amount: string;
  /** Current processing status of the transaction. */
  status: TransactionStatus;
  /** Withdrawal destination description; `null` for non-withdrawal rows. */
  withdrawal_method: string | null;
  /** Optional human-readable note attached to the transaction; `null` when absent. */
  note: string | null;
  /** ISO 8601 timestamp in the caller's resolved timezone (with offset). */
  created_at: string;
  /** Identifying information about the consultant that owns the row. */
  owner: IAdminTransactionOwnerResponse;
}
