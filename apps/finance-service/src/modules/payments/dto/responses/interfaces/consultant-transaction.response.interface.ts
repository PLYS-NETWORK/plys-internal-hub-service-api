import { ConsultantTransactionType, TransactionStatus } from '@plys/libraries/database/enums';

export interface IConsultantTransactionResponse {
  /** UUID of the consultant transaction record. */
  id: string;
  /** Transaction kind (e.g. `earning`, `withdrawal`). */
  type: ConsultantTransactionType;
  /** Decimal string representation of the transaction amount in the platform currency. */
  amount: string;
  /** Current processing status of the transaction (e.g. `pending`, `completed`, `failed`). */
  status: TransactionStatus;
  /** Withdrawal destination description (e.g. bank account label); `null` for non-withdrawal types. */
  withdrawal_method: string | null;
  /** Optional human-readable note attached to the transaction; `null` when absent. */
  note: string | null;
  /** Timestamp when the transaction record was created. */
  created_at: Date;
}
