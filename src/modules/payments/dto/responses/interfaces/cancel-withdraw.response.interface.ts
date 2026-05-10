import { TransactionStatus } from '@database/enums';

export interface ICancelWithdrawResponse {
  /** UUID of the withdraw transaction that was cancelled. */
  transaction_id: string;
  /** New status of the transaction after cancellation (always `FAILED`). */
  status: TransactionStatus;
  /** Amount returned to the account balance (decimal string, e.g. "250.00"). */
  restored_amount: string;
}
