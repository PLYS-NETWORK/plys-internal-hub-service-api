import { EnvironmentsService } from '@common/modules/environments';
import {
  ICheckoutSession,
  ICreateCheckoutSessionParams,
} from '@common/modules/payment/interfaces/checkout-session.interface';
import { IPaymentProvider } from '@common/modules/payment/interfaces/payment-provider.interface';
import { ICreateRefundParams } from '@common/modules/payment/interfaces/refund.interface';
import {
  ICreateTransferParams,
  ITransferResult,
} from '@common/modules/payment/interfaces/transfer.interface';
import {
  IWebhookEvent,
  WebhookEventType,
} from '@common/modules/payment/interfaces/webhook-event.interface';
import {
  InternalServerErrorException,
  Logger,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { Polar } from '@polar-sh/sdk';
import { Webhook, WebhookVerificationError } from 'standardwebhooks';

/**
 * Concrete Strategy: delivers payment operations via the Polar.sh API.
 *
 * Polar uses checkout sessions linked to pre-created product IDs.
 * The `externalProductId` on ICreateCheckoutSessionParams must be set
 * to a valid Polar product ID when using this provider.
 *
 * The `processorPaymentIntentId` field is intentionally null for Polar
 * checkouts — Polar uses order IDs for refunds instead.
 *
 * AMOUNT LOCK CONTRACT: Before creating a checkout session, this provider
 * verifies that the Polar product is configured as a custom-price (pay_what_you_want)
 * product. Only custom-price products allow the `amount` field to lock the checkout;
 * fixed-price products ignore the amount parameter, breaking the lock contract.
 */
export class PolarPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(PolarPaymentProvider.name);
  private readonly client: Polar;

  constructor(private readonly env: EnvironmentsService) {
    this.client = new Polar({
      accessToken: this.env.polarAccessToken,
      server: this.env.polarServer,
    });
  }

  /** @inheritdoc */
  public async createCheckoutSession(
    params: ICreateCheckoutSessionParams,
  ): Promise<ICheckoutSession> {
    const productId = params.externalProductId ?? params.invoiceId;

    await this.assertCustomPriceProduct(productId);

    try {
      const checkout = await this.client.checkouts.create({
        products: [productId],
        // Lock the checkout to the exact amount in cents. Only works when the Polar
        // product is configured as pay_what_you_want (custom-price); verified above.
        amount: params.amount,
        successUrl: params.successUrl,
        metadata: { invoiceId: params.invoiceId, ...params.metadata },
      });

      this.logger.log(`Polar checkout created: ${checkout.id} for invoice ${params.invoiceId}`);

      return {
        processorInvoiceId: checkout.id,
        // Polar does not expose a payment-intent concept at checkout creation time.
        processorPaymentIntentId: null,
        processorPaymentUrl: checkout.url,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Polar createCheckoutSession failed: ${message}`);
      throw new InternalServerErrorException('Failed to create payment session. Please try again.');
    }
  }

  /** @inheritdoc */
  public async createRefund(params: ICreateRefundParams): Promise<void> {
    try {
      // Polar refunds are created against the order ID (processorPaymentIntentId stores
      // the Polar order ID after the checkout.order_created webhook is received).
      await this.client.refunds.create({
        orderId: params.processorPaymentIntentId,
        // 'customer_request' is a valid RefundReason OpenEnum value.
        reason: 'customer_request',
        amount: params.amount,
        comment: params.reason ?? undefined,
      });

      this.logger.log(`Polar refund issued for order ${params.processorPaymentIntentId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Polar createRefund failed: ${message}`);
      throw new InternalServerErrorException('Failed to issue refund. Please try again.');
    }
  }

  /** @inheritdoc */
  public constructWebhookEvent(payload: Buffer, headers: Record<string, string>): IWebhookEvent {
    // Polar uses the Standard Webhooks spec (standardwebhooks library).
    // The signature covers webhook-id + "." + webhook-timestamp + "." + body,
    // so all three headers must be present — verifying only the body HMAC fails.
    // The secret must be base64-encoded before passing to the Webhook constructor.
    const base64Secret = Buffer.from(this.env.polarWebhookSecret, 'utf-8').toString('base64');
    const wh = new Webhook(base64Secret);

    let raw: Record<string, unknown>;
    try {
      raw = wh.verify(payload, headers) as Record<string, unknown>;
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        throw new UnauthorizedException('Invalid Polar webhook signature.');
      }
      throw err;
    }

    return {
      type: this.mapEventType(raw['type'] as string | undefined),
      data: (raw['data'] as Record<string, unknown>) ?? {},
      // Standard Webhooks uses the webhook-id header as the unique message ID.
      processorEventId: headers['webhook-id'] ?? '',
    };
  }

  /** @inheritdoc */
  public async createTransfer(_params: ICreateTransferParams): Promise<ITransferResult> {
    // Polar.sh does not support payouts/transfers. Withdrawals must use Stripe Connect.
    throw new NotImplementedException('Polar does not support transfers. Use Stripe for payouts.');
  }

  /** @inheritdoc */
  public async retrieveCheckoutSession(processorInvoiceId: string): Promise<ICheckoutSession> {
    try {
      const checkout = await this.client.checkouts.get({ id: processorInvoiceId });

      return {
        processorInvoiceId: checkout.id,
        // Polar does not expose a payment-intent at checkout creation time;
        // the order ID is only known after `checkout.order_created`.
        processorPaymentIntentId: null,
        processorPaymentUrl: checkout.url,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Polar retrieveCheckoutSession failed: ${message}`);
      throw new InternalServerErrorException(
        'Failed to retrieve payment session. Please try again.',
      );
    }
  }

  /** @inheritdoc */
  public async cancelCheckoutSession(_processorInvoiceId: string): Promise<void> {
    // Polar's SDK does not expose a server-side cancel/expire for checkouts —
    // they auto-expire on Polar's side. Callers must catch this and fall back
    // to local state cleanup.
    throw new NotImplementedException(
      'Polar checkouts cannot be cancelled programmatically; they auto-expire.',
    );
  }

  /**
   * Fetches the Polar product and asserts it is configured as a custom-price product.
   * A fixed-price product ignores the `amount` param, breaking the amount-lock contract.
   */
  private async assertCustomPriceProduct(productId: string): Promise<void> {
    let product: Awaited<ReturnType<typeof this.client.products.get>>;
    try {
      product = await this.client.products.get({ id: productId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Polar assertCustomPriceProduct — fetch failed: ${message}`);
      throw new InternalServerErrorException(
        'Failed to verify Polar product configuration. Please try again.',
      );
    }

    // Polar exposes prices as an array. We check whether any active price uses a
    // custom amount type. If none do, passing `amount` would be silently ignored.
    const hasCustomPrice = product.prices.some(
      (p) =>
        (p as unknown as Record<string, unknown>)['amountType'] === 'custom' ||
        (p as unknown as Record<string, unknown>)['amount_type'] === 'custom',
    );

    if (!hasCustomPrice) {
      this.logger.error(
        `Polar product ${productId} is not configured as custom-price. Amount lock cannot be guaranteed.`,
      );
      throw new InternalServerErrorException(
        'Polar product must be configured as a custom-price product to enforce a fixed checkout amount.',
      );
    }
  }

  private mapEventType(rawType: string | undefined): WebhookEventType {
    const map: Record<string, WebhookEventType> = {
      'order.paid': WebhookEventType.PAYMENT_SUCCEEDED,
      'order.refunded': WebhookEventType.REFUND_CREATED,
      'checkout.order_created': WebhookEventType.CHECKOUT_COMPLETED,
    };
    return map[rawType ?? ''] ?? WebhookEventType.UNKNOWN;
  }
}
