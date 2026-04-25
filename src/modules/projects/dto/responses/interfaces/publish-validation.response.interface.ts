export interface IPublishValidationResponse {
  /** Indicates whether the project can be published. */
  readonly can_publish: boolean;
  /** Reason code for why the project cannot be published, if applicable. */
  readonly reason_code: string | null;
  /** Current account balance of the user. */
  readonly account_balance: number;
  /** Title of the project. */
  readonly project_title: string;
  /** Amount of the project. */
  readonly project_amount: number;
  /** Commission rate as a decimal, e.g. 0.2500. Always 0 for credit businesses. */
  readonly commission_rate: number;
  /** Commission amount = project_amount × commission_rate. Always 0 for credit businesses. */
  readonly commission_amount: number;
  /** Total charged = project_amount + commission_amount. */
  readonly total_amount: number;
  /** Payment type, either 'credit' or 'pre-paid'. */
  readonly payment_type: 'credit' | 'pre-paid';
}
