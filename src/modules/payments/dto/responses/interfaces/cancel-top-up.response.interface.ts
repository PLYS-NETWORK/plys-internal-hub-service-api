import { TransactionStatus } from '@database/enums';

export interface ICancelTopUpResponse {
  /** UUID of the top-up transaction that was cancelled. */
  transaction_id: string;
  /** New status of the transaction after cancellation (always `FAILED`). */
  status: TransactionStatus;
}
