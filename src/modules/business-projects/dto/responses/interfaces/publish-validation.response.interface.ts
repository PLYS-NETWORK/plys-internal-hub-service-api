import { PaymentType } from '@database/enums';

export interface IPublishValidationResponse {
  readonly can_publish: boolean;
  readonly reason_code: string | null;
  readonly account_balance: number;
  readonly project_title: string;
  readonly project_amount: number;
  readonly commission_rate: number;
  readonly commission_amount: number;
  readonly total_amount: number;
  readonly payment_type: PaymentType;
}
