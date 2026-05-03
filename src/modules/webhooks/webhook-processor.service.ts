import { AppLogger } from '@common/modules/logger';
import { WebhookEventType } from '@common/modules/payment/interfaces/webhook-event.interface';
import { PaymentService } from '@common/modules/payment/payment.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { BusinessTransaction } from '@database/entities/finance/business-transaction.entity';
import { ConsultantTransaction } from '@database/entities/finance/consultant-transaction.entity';
import {
  CheckoutPaymentType,
  PaymentProcessor,
  TransactionStatus,
  WebhookStatus,
} from '@database/enums';
import { BillingInvoiceService } from '@modules/billing/services/billing-invoice.service';
import { NOTIFICATION_TYPES } from '@modules/notifications/enums/notification-type.enum';
import { NotificationDispatcherService } from '@modules/notifications/services/notification-dispatcher.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WebhookProcessorService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly paymentService: PaymentService,
    private readonly billingInvoiceService: BillingInvoiceService,
    private readonly notificationDispatcher: NotificationDispatcherService,
  ) {
    this.logger = new AppLogger(WebhookProcessorService.name, requestContext);
  }

  /**
   * Processes an incoming Polar webhook.
   */
  public async processPolarWebhook(
    payload: Buffer,
    headers: Record<string, string>,
  ): Promise<void> {
    this.logger.log(`processPolarWebhook — start`);

    const event = this.paymentService.constructWebhookEvent(payload, headers);

    // Check for idempotency
    const existingEvent = await this.uow.webhookEvents.findOne({
      where: { processor: PaymentProcessor.POLAR, eventId: event.processorEventId },
    });

    if (existingEvent) {
      this.logger.log(
        `processPolarWebhook — duplicate event, skipping | eventId: ${event.processorEventId}`,
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
        `processPolarWebhook — complete | eventId: ${event.processorEventId}, type: ${event.type}`,
      );
    } catch (error) {
      webhookEvent.status = WebhookStatus.FAILED;
      webhookEvent.lastError = error instanceof Error ? error.message : String(error);
      webhookEvent.retryCount += 1;
      await this.uow.webhookEvents.save(webhookEvent);

      this.logger.error(
        `processPolarWebhook — failed | eventId: ${event.processorEventId}, error: ${webhookEvent.lastError}`,
      );
      throw error;
    }
  }

  /**
   * Processes an incoming Stripe webhook.
   */
  public async processStripeWebhook(
    payload: Buffer,
    _headers: Record<string, string>,
  ): Promise<void> {
    this.logger.log(`processStripeWebhook — start`);

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
      this.logger.log(`processStripeWebhook — duplicate event, skipping | eventId: ${eventId}`);
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

      this.logger.log(`processStripeWebhook — complete | eventId: ${eventId}, type: ${eventType}`);
    } catch (error) {
      webhookEvent.status = WebhookStatus.FAILED;
      webhookEvent.lastError = error instanceof Error ? error.message : String(error);
      webhookEvent.retryCount += 1;
      await this.uow.webhookEvents.save(webhookEvent);

      this.logger.error(
        `processStripeWebhook — failed | eventId: ${eventId}, error: ${webhookEvent.lastError}`,
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
        this.logger.log(`processEvent — unknown event type: ${type}`);
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
        this.logger.log(`processStripeEvent — transfer event received: ${type}`);
        break;
      case 'transfer.failed':
        await this.handleTransferFailed(data);
        break;
      default:
        this.logger.log(`processStripeEvent — unhandled event type: ${type}`);
    }
  }

  private async handlePaymentSucceeded(data: Record<string, unknown>): Promise<void> {
    // Extract transaction ID and payment type from metadata
    const metadata = data['metadata'] as Record<string, string> | undefined;
    const transactionId = metadata?.['transactionId'];
    const paymentType = metadata?.['type'];

    if (!transactionId) {
      this.logger.warn(`handlePaymentSucceeded — no transactionId in metadata`);
      return;
    }

    // Route invoice payments to billing module
    if (paymentType === CheckoutPaymentType.INVOICE_PAYMENT) {
      const invoiceId = metadata?.['invoiceId'];
      if (!invoiceId) {
        this.logger.warn(
          `handlePaymentSucceeded — invoice_payment missing invoiceId | transactionId: ${transactionId}`,
        );
        return;
      }

      // Extract the processor's own checkout/session ID from the event payload.
      // Polar order.paid: data.checkoutId; Stripe checkout.session.completed: data.id.
      // This is cross-checked against invoice.processorInvoiceId to prevent a forged-
      // metadata attack from marking an unrelated invoice paid.
      const processorInvoiceId =
        (data['checkoutId'] as string | undefined) ?? (data['id'] as string | undefined) ?? '';

      await this.billingInvoiceService.completeInvoicePayment(
        invoiceId,
        transactionId,
        processorInvoiceId,
      );
      return;
    }

    // Default: top-up flow
    const transaction = await this.uow.businessTransactions.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      this.logger.warn(
        `handlePaymentSucceeded — transaction not found | transactionId: ${transactionId}`,
      );
      return;
    }

    // Reject any non-PENDING status — closes the cancel→pay race where a user
    // cancels locally (status=FAILED) and then completes payment on the gateway
    // before the cancellation propagates. Crediting a FAILED row would corrupt
    // the account balance.
    if (transaction.status !== TransactionStatus.PENDING) {
      this.logger.warn(
        `handlePaymentSucceeded — skipping non-pending transaction | transactionId: ${transactionId}, status: ${transaction.status}`,
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
        `handlePaymentSucceeded — balance updated | businessId: ${businessProfile.id}, oldBalance: ${currentBalance}, newBalance: ${newBalance}`,
      );

      void this.notificationDispatcher
        .dispatch({
          userId: businessProfile.userId,
          type: NOTIFICATION_TYPES.TOP_UP_COMPLETED,
          metadata: {
            transaction_id: transaction.id,
            transaction_number: transaction.transactionNumber,
            amount,
            currency: 'USD',
            new_balance: parseFloat(newBalance),
          },
          actorId: null,
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `handlePaymentSucceeded — notification dispatch failed | error: ${msg}`,
          );
        });
    }
  }

  private async handlePaymentFailed(data: Record<string, unknown>): Promise<void> {
    const metadata = data['metadata'] as Record<string, string> | undefined;
    const transactionId = metadata?.['transactionId'];

    if (!transactionId) {
      this.logger.warn(`handlePaymentFailed — no transactionId in metadata`);
      return;
    }

    const transaction = await this.uow.businessTransactions.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      this.logger.warn(
        `handlePaymentFailed — transaction not found | transactionId: ${transactionId}`,
      );
      return;
    }

    // Skip non-PENDING transactions — same reasoning as handlePaymentSucceeded:
    // a user-cancelled (FAILED) or already-completed row must not be re-stamped.
    if (transaction.status !== TransactionStatus.PENDING) {
      this.logger.warn(
        `handlePaymentFailed — skipping non-pending transaction | transactionId: ${transactionId}, status: ${transaction.status}`,
      );
      return;
    }

    transaction.status = TransactionStatus.FAILED;
    transaction.note = 'Payment failed';
    await this.uow.businessTransactions.save(transaction);

    this.logger.log(
      `handlePaymentFailed — transaction marked failed | transactionId: ${transactionId}`,
    );
  }

  private async handleRefundCreated(data: Record<string, unknown>): Promise<void> {
    // Handle refund events - create a reversal transaction
    const metadata = data['metadata'] as Record<string, string> | undefined;
    const transactionId = metadata?.['transactionId'];

    if (!transactionId) {
      this.logger.warn(`handleRefundCreated — no transactionId in metadata`);
      return;
    }

    const originalTransaction = await this.uow.businessTransactions.findOne({
      where: { id: transactionId },
    });

    if (!originalTransaction) {
      this.logger.warn(
        `handleRefundCreated — original transaction not found | transactionId: ${transactionId}`,
      );
      return;
    }

    // Mark original as reversed
    originalTransaction.status = TransactionStatus.REVERSED;
    await this.uow.businessTransactions.save(originalTransaction);

    this.logger.log(`handleRefundCreated — transaction reversed | transactionId: ${transactionId}`);
  }

  /**
   * Handles Stripe transfer.failed events.
   *
   * Why we reverse the balance: The withdraw strategies optimistically deduct the
   * balance and mark the transaction COMPLETED at API call time. If Stripe later
   * reports a failure, we must reverse that deduction by inserting a REVERSAL
   * record and crediting the balance back (append-only ledger pattern).
   */
  private async handleTransferFailed(data: Record<string, unknown>): Promise<void> {
    const dataObj = data['data'] as Record<string, unknown> | undefined;
    const transfer = dataObj?.['object'] as Record<string, unknown> | undefined;
    const transferId = transfer?.['id'] as string | undefined;

    if (!transferId) {
      this.logger.warn(`handleTransferFailed — no transfer ID in event`);
      return;
    }

    // Try to find the transaction in business transactions first
    const businessTx = await this.uow.businessTransactions.findOne({
      where: { processorEventId: transferId },
    });

    if (businessTx) {
      await this.reverseBusinessWithdrawal(businessTx);
      return;
    }

    // Try consultant transactions
    const consultantTx = await this.uow.consultantTransactions.findOne({
      where: { processorEventId: transferId },
    });

    if (consultantTx) {
      await this.reverseConsultantWithdrawal(consultantTx);
      return;
    }

    this.logger.warn(`handleTransferFailed — no matching transaction | transferId: ${transferId}`);
  }

  private async reverseBusinessWithdrawal(transaction: BusinessTransaction): Promise<void> {
    if (transaction.status === TransactionStatus.REVERSED) {
      this.logger.log(
        `reverseBusinessWithdrawal — already reversed | transactionId: ${transaction.id}`,
      );
      return;
    }

    transaction.status = TransactionStatus.REVERSED;
    transaction.note = 'Transfer failed — reversed by webhook';
    await this.uow.businessTransactions.save(transaction);

    // Credit balance back
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
        `reverseBusinessWithdrawal — balance restored | businessId: ${businessProfile.id}, amount: ${amount}, newBalance: ${newBalance}`,
      );

      void this.notificationDispatcher
        .dispatch({
          userId: businessProfile.userId,
          type: NOTIFICATION_TYPES.WITHDRAW_REVERSED,
          metadata: {
            transaction_id: transaction.id,
            transaction_number: transaction.transactionNumber,
            amount,
            currency: 'USD',
            new_balance: parseFloat(newBalance),
            reason: 'Stripe transfer failed',
          },
          actorId: null,
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `reverseBusinessWithdrawal — notification dispatch failed | error: ${msg}`,
          );
        });
    }
  }

  private async reverseConsultantWithdrawal(transaction: ConsultantTransaction): Promise<void> {
    if (transaction.status === TransactionStatus.REVERSED) {
      this.logger.log(
        `reverseConsultantWithdrawal — already reversed | transactionId: ${transaction.id}`,
      );
      return;
    }

    transaction.status = TransactionStatus.REVERSED;
    transaction.note = 'Transfer failed — reversed by webhook';
    await this.uow.consultantTransactions.save(transaction);

    // Credit balance back
    const consultantProfile = await this.uow.consultantProfiles.findOne({
      where: { id: transaction.consultantId },
    });

    if (consultantProfile) {
      const currentBalance = parseFloat(consultantProfile.accountBalance);
      const amount = parseFloat(transaction.amount);
      const newBalance = (currentBalance + amount).toFixed(2);

      await this.uow.consultantProfiles.update(consultantProfile.id, {
        accountBalance: newBalance,
      });

      this.logger.log(
        `reverseConsultantWithdrawal — balance restored | consultantId: ${consultantProfile.id}, amount: ${amount}, newBalance: ${newBalance}`,
      );
    }
  }

  private async handleStripeAccountUpdated(data: Record<string, unknown>): Promise<void> {
    const dataObj = data['data'] as Record<string, unknown> | undefined;
    const account = dataObj?.['object'] as Record<string, unknown> | undefined;
    const accountId = account?.['id'] as string | undefined;

    if (!accountId) {
      this.logger.warn(`handleStripeAccountUpdated — no account ID in event`);
      return;
    }

    // Check if account is fully onboarded
    const chargesEnabled = account?.['charges_enabled'] as boolean | undefined;
    const payoutsEnabled = account?.['payouts_enabled'] as boolean | undefined;

    if (!chargesEnabled || !payoutsEnabled) {
      this.logger.log(
        `handleStripeAccountUpdated — account not fully enabled | accountId: ${accountId}`,
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
        `handleStripeAccountUpdated — account already linked | businessId: ${existingBusiness.id}`,
      );
      return;
    }

    // Note: In production, you'd handle the OAuth callback flow separately
    // which would link the account ID to the business profile
    this.logger.log(
      `handleStripeAccountUpdated — account ready for linking | accountId: ${accountId}`,
    );
  }
}
