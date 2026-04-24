export interface IPublishValidationResponse {
  readonly can_publish: boolean;
  readonly reason_code: string | null;
  readonly account_balance: number;
  readonly project_title: string;
  readonly project_amount: number;
  /** Commission rate as a decimal, e.g. 0.2500. Always 0 for credit businesses. */
  readonly commission_rate: number;
  /** Commission amount = project_amount × commission_rate. Always 0 for credit businesses. */
  readonly commission_amount: number;
  /** Total charged = project_amount + commission_amount. */
  readonly total_amount: number;
  readonly payment_type: 'credit' | 'pre-paid';
}
