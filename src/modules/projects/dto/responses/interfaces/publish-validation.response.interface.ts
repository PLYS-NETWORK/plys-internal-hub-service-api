export interface IPublishValidationResponse {
  readonly can_publish: boolean;
  readonly reason_code: string | null;
  readonly account_balance: number;
  readonly project_title: string;
  readonly project_amount: number;
  readonly payment_type: 'credit' | 'pre-paid';
}
