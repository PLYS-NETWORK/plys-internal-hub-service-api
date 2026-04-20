import { BusinessTransactionType } from '@database/enums/business-transaction-type.enum';
import { TransactionStatus } from '@database/enums/transaction-status.enum';

export interface ITransactionResponse {
  id: string;
  type: BusinessTransactionType;
  amount: string;
  status: TransactionStatus;
  note: string | null;
  created_at: Date;
}
