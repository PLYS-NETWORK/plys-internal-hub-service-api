export interface ICreateRefundParams {
  /** Processor-side payment intent ID, stored on the Invoice entity. */
  readonly processorPaymentIntentId: string;
  /** Amount to refund in the smallest currency unit (e.g. cents for USD). */
  readonly amount: number;
  /** ISO 4217 currency code, e.g. 'USD'. */
  readonly currency: string;
  /** Optional human-readable reason forwarded to the processor. */
  readonly reason?: string;
}
