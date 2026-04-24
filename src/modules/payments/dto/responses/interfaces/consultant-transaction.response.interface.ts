import { ConsultantTransactionType, TransactionStatus } from '@database/enums';

export interface IConsultantTransactionResponse {
  id: string;
  type: ConsultantTransactionType;
  amount: string;
  status: TransactionStatus;
  withdrawal_method: string | null;
  note: string | null;
  created_at: Date;
}
