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
  constructWebhookEvent(payload: Buffer, headers: Record<string, string>): IWebhookEvent;

  /**
   * Creates a transfer/payout to a connected account.
   * Only supported by providers with payout capabilities (e.g., Stripe Connect).
   * Throws NotImplementedException if the provider does not support payouts.
   */
  createTransfer(params: ICreateTransferParams): Promise<ITransferResult>;

  /**
   * Re-fetches an existing checkout session from the provider and returns the
   * normalized session shape (including the redirect URL) so a frontend can
   * resume an interrupted checkout. The session must already exist on the
   * provider — this method does not create one.
   *
   * @param processorInvoiceId - Provider-side checkout/session ID stored as
   *   `processorEventId` on the local transaction (Polar checkout ID, Stripe
   *   session ID).
   * @returns Normalized session with the redirect URL refreshed from the provider.
   * @throws InternalServerErrorException — provider failed to return the session.
   */
  retrieveCheckoutSession(processorInvoiceId: string): Promise<ICheckoutSession>;

  /**
   * Best-effort cancellation of a pending checkout session on the provider side.
   * Some providers (e.g. Polar) do not expose a cancel/expire endpoint and must
   * throw `NotImplementedException`; callers are expected to swallow that and
   * fall back to local state cleanup.
   *
   * @param processorInvoiceId - Provider-side checkout/session ID.
   * @throws NotImplementedException — provider does not support cancellation.
   * @throws InternalServerErrorException — provider call failed.
   */
  cancelCheckoutSession(processorInvoiceId: string): Promise<void>;
}
