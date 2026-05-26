import { InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import {
  ICheckoutSession,
  ICreateCheckoutSessionParams,
} from '@plys/libraries/common-nest/modules/payment/interfaces/checkout-session.interface';
import { IPaymentProvider } from '@plys/libraries/common-nest/modules/payment/interfaces/payment-provider.interface';
import { ICreateRefundParams } from '@plys/libraries/common-nest/modules/payment/interfaces/refund.interface';
import {
  ICreateTransferParams,
  ITransferResult,
} from '@plys/libraries/common-nest/modules/payment/interfaces/transfer.interface';
import {
  IWebhookEvent,
  WebhookEventType,
} from '@plys/libraries/common-nest/modules/payment/interfaces/webhook-event.interface';
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

  /** @inheritdoc */
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
              // unit_amount is fixed — Stripe does not allow customer edits for
              // inline price_data line items (no editable amount input in checkout UI).
              unit_amount: params.amount,
              product_data: {
                name: params.lineDescription ?? `Invoice ${params.invoiceId}`,
              },
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

  /** @inheritdoc */
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

  /** @inheritdoc */
  public constructWebhookEvent(payload: Buffer, headers: Record<string, string>): IWebhookEvent {
    // stripe.webhooks.constructEvent validates the HMAC signature.
    // Must use the raw request body (Buffer) — do not parse to JSON first.
    const signature = headers['stripe-signature'] ?? '';
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

  /** @inheritdoc */
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

  /** @inheritdoc */
  public async retrieveCheckoutSession(processorInvoiceId: string): Promise<ICheckoutSession> {
    try {
      const session = await this.client.checkout.sessions.retrieve(processorInvoiceId);

      return {
        processorInvoiceId: session.id,
        processorPaymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        processorPaymentUrl: session.url ?? '',
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Stripe retrieveCheckoutSession failed: ${message}`);
      throw new InternalServerErrorException(
        'Failed to retrieve payment session. Please try again.',
      );
    }
  }

  /** @inheritdoc */
  public async cancelCheckoutSession(processorInvoiceId: string): Promise<void> {
    try {
      await this.client.checkout.sessions.expire(processorInvoiceId);
      this.logger.log(`Stripe checkout expired: ${processorInvoiceId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Stripe cancelCheckoutSession failed: ${message}`);
      throw new InternalServerErrorException('Failed to cancel payment session. Please try again.');
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
