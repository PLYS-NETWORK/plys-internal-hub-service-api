import { IPayerInfo } from '@database/entities/finance/interfaces/payer-info.interface';

/**
 * Represents the normalized checkout session returned by any payment provider.
 * Maps directly to the processor_* columns on the Invoice entity.
 *
 * CONTRACT: `amount` is always the final, non-editable charge in minor units (cents).
 * Payment provider implementations MUST enforce this — the customer must never be
 * able to change the amount in the checkout UI.
 */
export interface ICreateCheckoutSessionParams {
  /** Internal invoice ID — used as the order reference passed to the processor. */
  readonly invoiceId: string;
  /**
   * Final charge amount in minor currency units (e.g. cents).
   * This value is enforced server-side — providers must reject any configuration
   * that would allow the customer to alter it (e.g. editable amount on Polar
   * requires the product to be custom-price type).
   */
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
  /**
   * Human-readable description shown in the checkout UI as the line item name.
   * Falls back to `Invoice <invoiceId>` when omitted.
   */
  readonly lineDescription?: string;
  /** Optional free-form metadata forwarded to the processor. */
  readonly metadata?: Record<string, string>;
  /**
   * Payer information used to pre-fill the hosted checkout (name, email, billing
   * address). Card / PCI data is never included here. The user can still edit
   * these fields on the provider's hosted page; the webhook later overwrites the
   * stored snapshot if they do.
   */
  readonly payer?: IPayerInfo;
}

export interface ICheckoutSession {
  /** Processor-side invoice / order ID (stored as processor_invoice_id). */
  readonly processorInvoiceId: string;
  /** Processor-side payment intent ID (stored as processor_payment_intent_id). */
  readonly processorPaymentIntentId: string | null;
  /** Hosted payment page URL to redirect the buyer to. */
  readonly processorPaymentUrl: string;
}
