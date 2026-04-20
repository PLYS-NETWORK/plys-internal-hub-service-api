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
import { InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import Stripe from 'stripe';

/**
 * Concrete Strategy: delivers payment operations via the Stripe API.
 */
export class StripePaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(StripePaymentProvider.name);
  // InstanceType<typeof Stripe> resolves to the Stripe instance type,
  // avoiding the TS2709 "cannot use namespace as a type" error from Stripe v22.
  private readonly client: InstanceType<typeof Stripe>;

  constructor(private readonly env: EnvironmentsService) {
    this.client = new Stripe(this.env.stripeSecretKey);
  }

  public async createCheckoutSession(
    params: ICreateCheckoutSessionParams,
  ): Promise<ICheckoutSession> {
    try {
      const session = await this.client.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: params.currency.toLowerCase(),
              unit_amount: params.amount,
              product_data: { name: `Invoice ${params.invoiceId}` },
            },
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: { invoiceId: params.invoiceId, ...params.metadata },
      });

      this.logger.log(`Stripe checkout created: ${session.id} for invoice ${params.invoiceId}`);

      return {
        processorInvoiceId: session.id,
        processorPaymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        processorPaymentUrl: session.url ?? '',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Stripe createCheckoutSession failed: ${message}`);
      throw new InternalServerErrorException('Failed to create payment session. Please try again.');
    }
  }

  public async createRefund(params: ICreateRefundParams): Promise<void> {
    try {
      await this.client.refunds.create({
        payment_intent: params.processorPaymentIntentId,
        amount: params.amount,
        reason: 'requested_by_customer',
      });

      this.logger.log(`Stripe refund issued for payment intent ${params.processorPaymentIntentId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Stripe createRefund failed: ${message}`);
      throw new InternalServerErrorException('Failed to issue refund. Please try again.');
    }
  }

  public constructWebhookEvent(payload: Buffer, signature: string): IWebhookEvent {
    // stripe.webhooks.constructEvent validates the HMAC signature.
    // Must use the raw request body (Buffer) — do not parse to JSON first.
    let event;
    try {
      event = this.client.webhooks.constructEvent(payload, signature, this.env.stripeWebhookSecret);
    } catch {
      throw new UnauthorizedException('Invalid Stripe webhook signature.');
    }

    return {
      type: this.mapEventType(event.type),
      data: event.data.object as unknown as Record<string, unknown>,
      processorEventId: event.id,
    };
  }

  public async createTransfer(params: ICreateTransferParams): Promise<ITransferResult> {
    try {
      const transfer = await this.client.transfers.create({
        amount: params.amount,
        currency: params.currency.toLowerCase(),
        destination: params.destinationAccountId,
        transfer_group: params.transactionId,
        description: params.description,
        metadata: { transactionId: params.transactionId },
      });

      this.logger.log(
        `Stripe transfer created: ${transfer.id} to account ${params.destinationAccountId}`,
      );

      return {
        processorTransferId: transfer.id,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Stripe createTransfer failed: ${message}`);
      throw new InternalServerErrorException('Failed to create transfer. Please try again.');
    }
  }

  private mapEventType(rawType: string): WebhookEventType {
    const map: Record<string, WebhookEventType> = {
      'payment_intent.succeeded': WebhookEventType.PAYMENT_SUCCEEDED,
      'payment_intent.payment_failed': WebhookEventType.PAYMENT_FAILED,
      'charge.refunded': WebhookEventType.REFUND_CREATED,
      'checkout.session.completed': WebhookEventType.CHECKOUT_COMPLETED,
    };
    return map[rawType] ?? WebhookEventType.UNKNOWN;
  }
}
