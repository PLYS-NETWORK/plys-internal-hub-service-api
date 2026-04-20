import { WebhookEventType } from '@common/modules/payment/interfaces/webhook-event.interface';
import { PaymentService } from '@common/modules/payment/payment.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { PaymentProcessor } from '@database/enums/payment-processor.enum';
import { TransactionStatus } from '@database/enums/transaction-status.enum';
import { WebhookStatus } from '@database/enums/webhook-status.enum';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WebhookProcessorService {
  private readonly logger = new Logger(WebhookProcessorService.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Processes an incoming Polar webhook.
   */
  public async processPolarWebhook(payload: Buffer, signature: string): Promise<void> {
    this.logger.log(`[${this.rid}] processPolarWebhook — start`);

    const event = this.paymentService.constructWebhookEvent(payload, signature);

    // Check for idempotency
    const existingEvent = await this.uow.webhookEvents.findOne({
      where: { processor: PaymentProcessor.POLAR, eventId: event.processorEventId },
    });

    if (existingEvent) {
      this.logger.log(
        `[${this.rid}] processPolarWebhook — duplicate event, skipping | eventId: ${event.processorEventId}`,
      );
      return;
    }

    // Log the webhook event
    const webhookEvent = this.uow.webhookEvents.create({
      processor: PaymentProcessor.POLAR,
      eventId: event.processorEventId,
      eventType: event.type,
      payload: event.data,
      status: WebhookStatus.PROCESSING,
    });
    await this.uow.webhookEvents.save(webhookEvent);

    try {
      await this.processEvent(event.type, event.data, PaymentProcessor.POLAR);

      webhookEvent.status = WebhookStatus.PROCESSED;
      webhookEvent.processedAt = new Date();
      await this.uow.webhookEvents.save(webhookEvent);

      this.logger.log(
        `[${this.rid}] processPolarWebhook — complete | eventId: ${event.processorEventId}, type: ${event.type}`,
      );
    } catch (error) {
      webhookEvent.status = WebhookStatus.FAILED;
      webhookEvent.lastError = error instanceof Error ? error.message : String(error);
      webhookEvent.retryCount += 1;
      await this.uow.webhookEvents.save(webhookEvent);

      this.logger.error(
        `[${this.rid}] processPolarWebhook — failed | eventId: ${event.processorEventId}, error: ${webhookEvent.lastError}`,
      );
      throw error;
    }
  }

  /**
   * Processes an incoming Stripe webhook.
   */
  public async processStripeWebhook(payload: Buffer, _signature: string): Promise<void> {
    this.logger.log(`[${this.rid}] processStripeWebhook — start`);

    // Use Stripe provider to construct the event
    // Note: This would need a separate method or the PaymentService to handle Stripe specifically
    // For now, we'll handle account.updated events for Stripe Connect
    const raw = JSON.parse(payload.toString('utf8')) as Record<string, unknown>;
    const eventId = raw['id'] as string;
    const eventType = raw['type'] as string;

    // Check for idempotency
    const existingEvent = await this.uow.webhookEvents.findOne({
      where: { processor: PaymentProcessor.STRIPE, eventId },
    });

    if (existingEvent) {
      this.logger.log(
        `[${this.rid}] processStripeWebhook — duplicate event, skipping | eventId: ${eventId}`,
      );
      return;
    }

    // Log the webhook event
    const webhookEvent = this.uow.webhookEvents.create({
      processor: PaymentProcessor.STRIPE,
      eventId,
      eventType,
      payload: raw,
      status: WebhookStatus.PROCESSING,
    });
    await this.uow.webhookEvents.save(webhookEvent);

    try {
      await this.processStripeEvent(eventType, raw);

      webhookEvent.status = WebhookStatus.PROCESSED;
      webhookEvent.processedAt = new Date();
      await this.uow.webhookEvents.save(webhookEvent);

      this.logger.log(
        `[${this.rid}] processStripeWebhook — complete | eventId: ${eventId}, type: ${eventType}`,
      );
    } catch (error) {
      webhookEvent.status = WebhookStatus.FAILED;
      webhookEvent.lastError = error instanceof Error ? error.message : String(error);
      webhookEvent.retryCount += 1;
      await this.uow.webhookEvents.save(webhookEvent);

      this.logger.error(
        `[${this.rid}] processStripeWebhook — failed | eventId: ${eventId}, error: ${webhookEvent.lastError}`,
      );
      throw error;
    }
  }

  private async processEvent(
    type: string,
    data: Record<string, unknown>,
    _processor: PaymentProcessor,
  ): Promise<void> {
    switch (type) {
      case WebhookEventType.PAYMENT_SUCCEEDED:
      case WebhookEventType.CHECKOUT_COMPLETED:
        await this.handlePaymentSucceeded(data);
        break;
      case WebhookEventType.PAYMENT_FAILED:
        await this.handlePaymentFailed(data);
        break;
      case WebhookEventType.REFUND_CREATED:
        await this.handleRefundCreated(data);
        break;
      default:
        this.logger.log(`[${this.rid}] processEvent — unknown event type: ${type}`);
    }
  }

  private async processStripeEvent(type: string, data: Record<string, unknown>): Promise<void> {
    switch (type) {
      case 'account.updated':
        await this.handleStripeAccountUpdated(data);
        break;
      case 'transfer.created':
      case 'transfer.paid':
        // Transfer events are informational — no action needed as we mark
        // transactions complete immediately after successful API call
        this.logger.log(`[${this.rid}] processStripeEvent — transfer event received: ${type}`);
        break;
      default:
        this.logger.log(`[${this.rid}] processStripeEvent — unhandled event type: ${type}`);
    }
  }

  private async handlePaymentSucceeded(data: Record<string, unknown>): Promise<void> {
    // Extract transaction ID from metadata
    const metadata = data['metadata'] as Record<string, string> | undefined;
    const transactionId = metadata?.['transactionId'];

    if (!transactionId) {
      this.logger.warn(`[${this.rid}] handlePaymentSucceeded — no transactionId in metadata`);
      return;
    }

    const transaction = await this.uow.businessTransactions.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      this.logger.warn(
        `[${this.rid}] handlePaymentSucceeded — transaction not found | transactionId: ${transactionId}`,
      );
      return;
    }

    if (transaction.status === TransactionStatus.COMPLETED) {
      this.logger.log(
        `[${this.rid}] handlePaymentSucceeded — already completed | transactionId: ${transactionId}`,
      );
      return;
    }

    // Update transaction status
    transaction.status = TransactionStatus.COMPLETED;
    await this.uow.businessTransactions.save(transaction);

    // Update business account balance
    const businessProfile = await this.uow.businessProfiles.findOne({
      where: { id: transaction.businessId },
    });

    if (businessProfile) {
      const currentBalance = parseFloat(businessProfile.accountBalance);
      const amount = parseFloat(transaction.amount);
      const newBalance = (currentBalance + amount).toFixed(2);

      await this.uow.businessProfiles.update(businessProfile.id, {
        accountBalance: newBalance,
      });

      this.logger.log(
        `[${this.rid}] handlePaymentSucceeded — balance updated | businessId: ${businessProfile.id}, oldBalance: ${currentBalance}, newBalance: ${newBalance}`,
      );
    }
  }

  private async handlePaymentFailed(data: Record<string, unknown>): Promise<void> {
    const metadata = data['metadata'] as Record<string, string> | undefined;
    const transactionId = metadata?.['transactionId'];

    if (!transactionId) {
      this.logger.warn(`[${this.rid}] handlePaymentFailed — no transactionId in metadata`);
      return;
    }

    const transaction = await this.uow.businessTransactions.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      this.logger.warn(
        `[${this.rid}] handlePaymentFailed — transaction not found | transactionId: ${transactionId}`,
      );
      return;
    }

    transaction.status = TransactionStatus.FAILED;
    transaction.note = 'Payment failed';
    await this.uow.businessTransactions.save(transaction);

    this.logger.log(
      `[${this.rid}] handlePaymentFailed — transaction marked failed | transactionId: ${transactionId}`,
    );
  }

  private async handleRefundCreated(data: Record<string, unknown>): Promise<void> {
    // Handle refund events - create a reversal transaction
    const metadata = data['metadata'] as Record<string, string> | undefined;
    const transactionId = metadata?.['transactionId'];

    if (!transactionId) {
      this.logger.warn(`[${this.rid}] handleRefundCreated — no transactionId in metadata`);
      return;
    }

    const originalTransaction = await this.uow.businessTransactions.findOne({
      where: { id: transactionId },
    });

    if (!originalTransaction) {
      this.logger.warn(
        `[${this.rid}] handleRefundCreated — original transaction not found | transactionId: ${transactionId}`,
      );
      return;
    }

    // Mark original as reversed
    originalTransaction.status = TransactionStatus.REVERSED;
    await this.uow.businessTransactions.save(originalTransaction);

    this.logger.log(
      `[${this.rid}] handleRefundCreated — transaction reversed | transactionId: ${transactionId}`,
    );
  }

  private async handleStripeAccountUpdated(data: Record<string, unknown>): Promise<void> {
    const dataObj = data['data'] as Record<string, unknown> | undefined;
    const account = dataObj?.['object'] as Record<string, unknown> | undefined;
    const accountId = account?.['id'] as string | undefined;

    if (!accountId) {
      this.logger.warn(`[${this.rid}] handleStripeAccountUpdated — no account ID in event`);
      return;
    }

    // Check if account is fully onboarded
    const chargesEnabled = account?.['charges_enabled'] as boolean | undefined;
    const payoutsEnabled = account?.['payouts_enabled'] as boolean | undefined;

    if (!chargesEnabled || !payoutsEnabled) {
      this.logger.log(
        `[${this.rid}] handleStripeAccountUpdated — account not fully enabled | accountId: ${accountId}`,
      );
      return;
    }

    // Find business by state (business ID was passed in OAuth state)
    // In a real implementation, you'd need a mapping table or different approach
    // For now, we'll search by the Stripe account ID in case it was already partially set
    const existingBusiness = await this.uow.businessProfiles.findOne({
      where: { stripeConnectAccountId: accountId },
    });

    if (existingBusiness) {
      this.logger.log(
        `[${this.rid}] handleStripeAccountUpdated — account already linked | businessId: ${existingBusiness.id}`,
      );
      return;
    }

    // Note: In production, you'd handle the OAuth callback flow separately
    // which would link the account ID to the business profile
    this.logger.log(
      `[${this.rid}] handleStripeAccountUpdated — account ready for linking | accountId: ${accountId}`,
    );
  }
}
