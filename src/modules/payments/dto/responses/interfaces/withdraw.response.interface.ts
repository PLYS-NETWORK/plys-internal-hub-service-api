import { TransactionStatus } from '@database/enums';

export interface IWithdrawResponse {
  is_connected: boolean;
  onboarding_url: string | null;
  transaction_id: string | null;
  status: TransactionStatus | null;
}
