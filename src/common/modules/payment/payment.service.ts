import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentsService } from '../environments';
import { PaymentProcessor } from '../../../database/enums/payment-processor.enum';
import {
  ICheckoutSession,
  ICreateCheckoutSessionParams,
} from './interfaces/checkout-session.interface';
import { ICreateRefundParams } from './interfaces/refund.interface';
import { IWebhookEvent } from './interfaces/webhook-event.interface';
import { PaymentProviderRegistry } from './payment-provider.registry';

/**
 * PaymentService is the context in the Strategy Factory Pattern.
 *
 * It never references a concrete provider directly — all operations are
 * delegated to the active IPaymentProvider resolved by PaymentProviderRegistry.
 *
 * The active processor is determined at call-time from EnvironmentsService,
 * allowing a restart-free switch if the env var is hot-reloaded.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly registry: PaymentProviderRegistry,
    private readonly env: EnvironmentsService,
  ) {}

  /**
   * Creates a hosted checkout session for the given invoice.
   * Returns processor IDs and the payment URL to redirect the buyer to.
   */
  public async createCheckoutSession(
    params: ICreateCheckoutSessionParams,
  ): Promise<ICheckoutSession> {
    this.logger.log(
      `Creating checkout session via ${this.env.paymentProcessor} for invoice ${params.invoiceId}`,
    );
    return this.activeProvider().createCheckoutSession(params);
  }

  /**
   * Issues a full or partial refund for a completed payment.
   */
  public async createRefund(params: ICreateRefundParams): Promise<void> {
    this.logger.log(
      `Creating refund via ${this.env.paymentProcessor} for ${params.processorPaymentIntentId}`,
    );
    return this.activeProvider().createRefund(params);
  }

  /**
   * Validates the incoming webhook signature and returns a normalized event.
   * Must be called with the raw request body (Buffer) before any JSON parsing.
   */
  public constructWebhookEvent(payload: Buffer, signature: string): IWebhookEvent {
    return this.activeProvider().constructWebhookEvent(payload, signature);
  }

  // Resolves the currently configured payment provider from the registry.
  private activeProvider() {
    return this.registry.create(this.env.paymentProcessor as PaymentProcessor);
  }
}
