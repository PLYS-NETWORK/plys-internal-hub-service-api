import { ICheckoutSession, ICreateCheckoutSessionParams } from './checkout-session.interface';
import { ICreateRefundParams } from './refund.interface';
import { ICreateTransferParams, ITransferResult } from './transfer.interface';
import { IWebhookEvent } from './webhook-event.interface';

/**
 * Strategy interface for payment processing.
 *
 * Any concrete provider (Polar, Stripe, etc.) must implement this contract.
 * Consumers depend only on this interface — swapping the active provider
 * requires no changes outside of PaymentModule.
 */
export interface IPaymentProvider {
  /**
   * Creates a hosted checkout session and returns the redirect URL.
   * The returned IDs should be persisted on the Invoice entity.
   */
  createCheckoutSession(params: ICreateCheckoutSessionParams): Promise<ICheckoutSession>;

  /**
   * Issues a full or partial refund for a completed payment.
   */
  createRefund(params: ICreateRefundParams): Promise<void>;

  /**
   * Validates the webhook signature and returns a normalized IWebhookEvent.
   * Throws if the signature is invalid (security boundary — never skip this).
   */
  constructWebhookEvent(payload: Buffer, signature: string): IWebhookEvent;

  /**
   * Creates a transfer/payout to a connected account.
   * Only supported by providers with payout capabilities (e.g., Stripe Connect).
   * Throws NotImplementedException if the provider does not support payouts.
   */
  createTransfer(params: ICreateTransferParams): Promise<ITransferResult>;
}
