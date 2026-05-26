export interface IPaymentTopUpCompletedEvent {
  readonly transaction_id: string;
  readonly transaction_number: string;
  readonly user_id: string;
  readonly amount: number;
  readonly currency: string;
  readonly new_balance: number;
  /** Carried so the admin notification can reference the business profile. */
  readonly business_id: string;
  readonly business_name: string;
}

export interface IPaymentTopUpRefundedEvent {
  readonly transaction_id: string;
  readonly transaction_number: string;
  readonly user_id: string;
  readonly amount: number;
  readonly currency: string;
}

export interface IPaymentWithdrawCompletedEvent {
  readonly transaction_id: string;
  readonly transaction_number: string;
  readonly user_id: string;
  readonly amount: number;
  readonly currency: string;
  readonly new_balance: number;
}

export interface IPaymentWithdrawReversedEvent extends IPaymentWithdrawCompletedEvent {
  readonly reason: string;
}
