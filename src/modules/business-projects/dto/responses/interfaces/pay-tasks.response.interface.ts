import { PaymentType } from '@database/enums';

export interface IPayTasksResponse {
  moved_task_ids: string[];
  project_amount: string;
  commission_rate: string;
  commission_amount: string;
  total_amount: string;
  payment_type: PaymentType;
  transaction_id: string;
}
