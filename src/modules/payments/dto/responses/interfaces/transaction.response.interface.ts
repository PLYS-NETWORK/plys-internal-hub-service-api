import { BusinessTransactionType, TransactionStatus } from '@database/enums';

export interface ITransactionResponse {
  /** UUID of the business transaction record. */
  id: string;
  /** Transaction kind (e.g. `top_up`, `project_payment`, `refund`). */
  type: BusinessTransactionType;
  /** Decimal string representation of the transaction amount in the platform currency. */
  amount: string;
  /** Current processing status of the transaction (e.g. `pending`, `completed`, `failed`). */
  status: TransactionStatus;
  /** Optional human-readable note attached to the transaction; `null` when absent. */
  note: string | null;
  /** Timestamp when the transaction record was created. */
  created_at: Date;
}
