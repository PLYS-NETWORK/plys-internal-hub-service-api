import { ConsultantTransactionType } from '@database/enums/consultant-transaction-type.enum';
import { TransactionStatus } from '@database/enums/transaction-status.enum';

export interface IConsultantTransactionResponse {
  id: string;
  type: ConsultantTransactionType;
  amount: string;
  status: TransactionStatus;
  withdrawal_method: string | null;
  note: string | null;
  created_at: Date;
}
