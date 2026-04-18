/**
 * Represents the normalized checkout session returned by any payment provider.
 * Maps directly to the processor_* columns on the Invoice entity.
 */
export interface ICreateCheckoutSessionParams {
  /** Internal invoice ID — used as the order reference passed to the processor. */
  readonly invoiceId: string;
  readonly amount: number;
  /** ISO 4217 currency code, e.g. 'USD'. */
  readonly currency: string;
  /** URL the processor redirects to after a successful payment. */
  readonly successUrl: string;
  /** URL the processor redirects to if the buyer cancels. */
  readonly cancelUrl: string;
  /**
   * Polar-specific: the pre-created Polar product ID to attach to the checkout.
   * Polar requires existing product IDs; pass the Polar product ID for the invoice type.
   * Not required for Stripe (which creates line items from amount + currency).
   */
  readonly externalProductId?: string;
  /** Optional free-form metadata forwarded to the processor. */
  readonly metadata?: Record<string, string>;
}

export interface ICheckoutSession {
  /** Processor-side invoice / order ID (stored as processor_invoice_id). */
  readonly processorInvoiceId: string;
  /** Processor-side payment intent ID (stored as processor_payment_intent_id). */
  readonly processorPaymentIntentId: string | null;
  /** Hosted payment page URL to redirect the buyer to. */
  readonly processorPaymentUrl: string;
}
