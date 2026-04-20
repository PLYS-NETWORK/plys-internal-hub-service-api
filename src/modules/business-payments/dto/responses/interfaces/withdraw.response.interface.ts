import { TransactionStatus } from '@database/enums/transaction-status.enum';

export interface IWithdrawResponse {
  transaction_id: string;
  status: TransactionStatus;
}
