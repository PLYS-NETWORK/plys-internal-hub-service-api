import { ICheckoutSession, ICreateCheckoutSessionParams } from './checkout-session.interface';
import { ICreateRefundParams } from './refund.interface';
import { ICreateTransferParams, ITransferResult } from './transfer.interface';
import { IWebhookEvent } from './webhook-event.interface';

/**
 * Application-level payment facade.
 *
 * Delegates to the active `IPaymentProvider` strategy selected at startup.
 * Consumers inject `PaymentService` directly — never the concrete provider.
 * Swapping the provider requires only a binding change in `PaymentModule`.
 */
export interface IPaymentService {
  /**
   * Creates a hosted checkout session and returns the processor redirect URL.
   *
   * The `amount` in the params is enforced as a locked, non-editable charge in
   * minor currency units (cents). Concrete providers must guarantee the customer
   * cannot alter the amount in the checkout UI.
   *
   * @param params - Checkout session parameters including amount, currency, and redirect URLs.
   * @returns Normalized session object containing the processor IDs and redirect URL.
   * @throws InternalServerErrorException — provider failed to create the session.
   */
  createCheckoutSession(params: ICreateCheckoutSessionParams): Promise<ICheckoutSession>;

  /**
   * Issues a full or partial refund for a completed payment identified by
   * its processor payment intent ID.
   *
   * @param params - Refund parameters: processor payment intent ID, amount in cents, and optional reason.
   * @throws InternalServerErrorException — provider failed to issue the refund.
   */
  createRefund(params: ICreateRefundParams): Promise<void>;

  /**
   * Validates the incoming webhook signature and returns a normalized `IWebhookEvent`.
   *
   * This is the security boundary — the raw request body (as a `Buffer`) and all
   * HTTP headers must be passed unmodified to allow HMAC verification. Never call
   * this with an already-parsed JSON body.
   *
   * @param payload - Raw request body as a Buffer.
   * @param headers - All HTTP request headers as a plain object.
   * @returns A normalized webhook event with a provider-agnostic type and data payload.
   * @throws UnauthorizedException — webhook signature verification failed.
   */
  constructWebhookEvent(payload: Buffer, headers: Record<string, string>): IWebhookEvent;

  /**
   * Creates a transfer/payout to a connected external account (e.g. Stripe Connect).
   *
   * Only providers with payout capabilities support this operation. Providers that
   * do not support transfers (e.g. Polar) must throw `NotImplementedException`.
   *
   * @param params - Transfer parameters: amount in cents, currency, destination account ID, and reference IDs.
   * @returns Result containing the processor-side transfer ID for reconciliation.
   * @throws NotImplementedException — active provider does not support payouts.
   * @throws InternalServerErrorException — provider failed to create the transfer.
   */
  createTransfer(params: ICreateTransferParams): Promise<ITransferResult>;
}
