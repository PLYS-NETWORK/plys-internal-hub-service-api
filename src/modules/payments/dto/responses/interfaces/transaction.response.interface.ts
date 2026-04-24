import { BusinessTransactionType, TransactionStatus } from '@database/enums';

export interface ITransactionResponse {
  id: string;
  type: BusinessTransactionType;
  amount: string;
  status: TransactionStatus;
  note: string | null;
  created_at: Date;
}
