import { Injectable } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { PaymentProcessor } from '@plys/libraries/database/enums';

import { IPaymentProvider } from './interfaces';
import {
  ICheckoutSession,
  ICreateCheckoutSessionParams,
} from './interfaces/checkout-session.interface';
import { IPaymentService } from './interfaces/payment-service.interface';
import { ICreateRefundParams } from './interfaces/refund.interface';
import { ICreateTransferParams, ITransferResult } from './interfaces/transfer.interface';
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
export class PaymentService implements IPaymentService {
  private readonly logger: AppLogger;

  constructor(
    private readonly registry: PaymentProviderRegistry,
    private readonly env: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(PaymentService.name, requestContext);
  }

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
  public constructWebhookEvent(payload: Buffer, headers: Record<string, string>): IWebhookEvent {
    return this.activeProvider().constructWebhookEvent(payload, headers);
  }

  /**
   * Creates a transfer/payout to a connected account.
   * Uses Stripe provider regardless of active payment processor since Polar
   * does not support payouts.
   */
  public async createTransfer(params: ICreateTransferParams): Promise<ITransferResult> {
    this.logger.log(
      `Creating transfer via stripe for account ${params.destinationAccountId}, amount: ${params.amount}`,
    );
    // Always use Stripe for transfers since Polar doesn't support payouts
    return this.registry.create(PaymentProcessor.STRIPE).createTransfer(params);
  }

  /**
   * Re-fetches an existing checkout session from the active provider so the
   * frontend can resume an interrupted top-up at the same redirect URL.
   */
  public async retrieveCheckoutSession(processorInvoiceId: string): Promise<ICheckoutSession> {
    this.logger.log(
      `Retrieving checkout session via ${this.env.paymentProcessor} for ${processorInvoiceId}`,
    );
    return this.activeProvider().retrieveCheckoutSession(processorInvoiceId);
  }

  /**
   * Best-effort cancellation of a pending checkout session on the active provider.
   * Re-throws `NotImplementedException` for callers to handle (Polar does not
   * support programmatic cancellation).
   */
  public async cancelCheckoutSession(processorInvoiceId: string): Promise<void> {
    this.logger.log(
      `Cancelling checkout session via ${this.env.paymentProcessor} for ${processorInvoiceId}`,
    );
    return this.activeProvider().cancelCheckoutSession(processorInvoiceId);
  }

  // Resolves the currently configured payment provider from the registry.
  private activeProvider(): IPaymentProvider {
    return this.registry.create(this.env.paymentProcessor as PaymentProcessor);
  }
}
