import { PaymentType } from '@database/enums';

export interface IAddToBoardValidationResponse {
  is_valid: boolean;
  reason_code: string | null;
  moved_task_ids: string[];
  project_amount: string;
  commission_rate: string;
  commission_amount: string;
  total_amount: string;
  payment_type: PaymentType;
  account_balance: string;
}
