import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { NOTIFICATION_EVENTS } from '@common/events';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EmailService } from '@common/modules/email/email.service';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { PaymentService } from '@common/modules/payment/payment.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { BusinessTransaction } from '@database/entities/finance/business-transaction.entity';
import { IPayerInfo } from '@database/entities/finance/interfaces/payer-info.interface';
import {
  BusinessTransactionType,
  CheckoutPaymentType,
  Currency,
  InvoiceStatus,
  PaymentProcessor,
  TransactionStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable, NotImplementedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';

import { CreateTopUpDto } from '../dto/requests/create-top-up.dto';
import { ListBusinessTransactionsDto } from '../dto/requests/list-business-transactions.dto';
import { PayerInfoDto } from '../dto/requests/payer-info.dto';
import { SettleInvoiceDto } from '../dto/requests/settle-invoice.dto';
import {
  CancelTopUpResponseDto,
  SettleInvoiceResponseDto,
  TopUpResponseDto,
  TransactionResponseDto,
} from '../dto/responses';
import { IBusinessPaymentsService } from './interfaces/business-payments-service.interface';

@Injectable()
export class BusinessPaymentsService implements IBusinessPaymentsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly paymentService: PaymentService,
    private readonly env: EnvironmentsService,
    private readonly emailService: EmailService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger = new AppLogger(BusinessPaymentsService.name, requestContext);
  }

  /** @inheritdoc */
  public async createTopUp(dto: CreateTopUpDto): Promise<TopUpResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`createTopUp — start | userId: ${userId}, amount: ${dto.amount}`);

    const businessProfile = await this.uow.businessProfiles.findOne({ where: { userId } });
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // Create pending transaction. Wrapped in `withTransaction` so the
    // transaction-number advisory lock has an active xact to attach to.
    const amountStr = dto.amount.toFixed(2);
    const payerInfo = this.toPayerInfoEntity(dto.payerInfo);
    const savedTransaction = await this.uow.withTransaction(async (txUow) => {
      const transactionNumber = await txUow.transactionNumbers.next(
        'PLS',
        BusinessTransactionType.TOP_UP,
      );
      const transaction = txUow.businessTransactions.create({
        transactionNumber,
        businessId: businessProfile.id,
        type: BusinessTransactionType.TOP_UP,
        amount: amountStr,
        totalAmount: amountStr,
        status: TransactionStatus.PENDING,
        note: 'Top-up via payment checkout',
        payerInfo,
      });
      return txUow.businessTransactions.save(transaction);
    });

    try {
      const checkoutSession = await this.paymentService.createCheckoutSession({
        invoiceId: savedTransaction.id,
        amount: Math.round(dto.amount * 100), // Convert to cents
        currency: Currency.USD,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
        externalProductId: this.env.polarTopUpProductId,
        metadata: {
          transactionId: savedTransaction.id,
          businessId: businessProfile.id,
          type: CheckoutPaymentType.TOP_UP,
        },
        payer: payerInfo,
      });

      savedTransaction.processorEventId = checkoutSession.processorInvoiceId;
      await this.uow.businessTransactions.save(savedTransaction);

      this.logger.log(
        `createTopUp — complete | transactionId: ${savedTransaction.id}, redirectUrl: ${checkoutSession.processorPaymentUrl}`,
      );

      return plainToInstance(
        TopUpResponseDto,
        {
          transaction_id: savedTransaction.id,
          redirect_url: checkoutSession.processorPaymentUrl,
        },
        { excludeExtraneousValues: true },
      );
    } catch (error) {
      savedTransaction.status = TransactionStatus.FAILED;
      savedTransaction.note = 'Checkout session creation failed';
      await this.uow.businessTransactions.save(savedTransaction);

      this.logger.error(
        `createTopUp — failed | transactionId: ${savedTransaction.id}, error: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw new TranslatableException({
        messageKey: 'error.payment.checkout_failed',
        errorCode: ERROR_CODES.PAYMENT_CHECKOUT_FAILED,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  /** @inheritdoc */
  public async settleInvoice(dto: SettleInvoiceDto): Promise<SettleInvoiceResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`settleInvoice — start | userId: ${userId}, invoiceId: ${dto.invoiceId}`);

    const businessProfile = await this.uow.businessProfiles.findOne({ where: { userId } });
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const invoice = await this.uow.invoices.findOne({ where: { id: dto.invoiceId } });
    if (!invoice) {
      throw new TranslatableException({
        messageKey: 'error.billing.invoice_not_found',
        errorCode: ERROR_CODES.BILLING_INVOICE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (invoice.businessId !== businessProfile.id) {
      throw new TranslatableException({
        messageKey: 'error.billing.invoice_not_owned',
        errorCode: ERROR_CODES.BILLING_INVOICE_NOT_OWNED,
        status: HttpStatus.FORBIDDEN,
      });
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new TranslatableException({
        messageKey: 'error.billing.invoice_already_paid',
        errorCode: ERROR_CODES.BILLING_INVOICE_ALREADY_PAID,
        status: HttpStatus.CONFLICT,
      });
    }

    // Find the MONTHLY_BILLING business transaction linked to this invoice
    const businessTxn = await this.uow.businessTransactions.findOne({
      where: {
        invoiceId: invoice.id,
        type: BusinessTransactionType.MONTHLY_BILLING,
      },
    });

    if (!businessTxn) {
      this.logger.error(
        `settleInvoice — no business transaction for invoice | invoiceId: ${invoice.id}`,
      );
      throw new TranslatableException({
        messageKey: 'error.billing.invoice_not_found',
        errorCode: ERROR_CODES.BILLING_INVOICE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const payerInfo = this.toPayerInfoEntity(dto.payerInfo);

    try {
      const checkoutSession = await this.paymentService.createCheckoutSession({
        invoiceId: invoice.id,
        amount: Math.round(parseFloat(invoice.amount) * 100),
        currency: invoice.currency,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
        externalProductId: this.env.polarInvoiceProductId,
        metadata: {
          transactionId: businessTxn.id,
          businessId: businessProfile.id,
          invoiceId: invoice.id,
          type: CheckoutPaymentType.INVOICE_PAYMENT,
        },
        payer: payerInfo,
      });

      // Save processor IDs on invoice for tracking
      invoice.processorName = PaymentProcessor.POLAR;
      invoice.processorInvoiceId = checkoutSession.processorInvoiceId;
      invoice.processorPaymentIntentId = checkoutSession.processorPaymentIntentId;
      invoice.processorPaymentUrl = checkoutSession.processorPaymentUrl;
      await this.uow.invoices.save(invoice);

      // Save processor event ID + payer info on business transaction
      businessTxn.processorEventId = checkoutSession.processorInvoiceId;
      businessTxn.payerInfo = payerInfo;
      await this.uow.businessTransactions.save(businessTxn);

      this.logger.log(
        `settleInvoice — complete | invoiceId: ${invoice.id}, redirectUrl: ${checkoutSession.processorPaymentUrl}`,
      );

      return plainToInstance(
        SettleInvoiceResponseDto,
        {
          invoice_id: invoice.id,
          redirect_url: checkoutSession.processorPaymentUrl,
        },
        { excludeExtraneousValues: true },
      );
    } catch (error) {
      this.logger.error(
        `settleInvoice — failed | invoiceId: ${invoice.id}, error: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw new TranslatableException({
        messageKey: 'error.billing.checkout_failed',
        errorCode: ERROR_CODES.BILLING_CHECKOUT_FAILED,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  /** @inheritdoc */
  public async listTransactions(
    dto: ListBusinessTransactionsDto,
  ): Promise<PageDto<TransactionResponseDto>> {
    const userId = this.requestContext.userId!;
    this.logger.log(
      `listTransactions — start | userId: ${userId}, page: ${dto.page}, limit: ${dto.limit}`,
    );

    const businessProfile = await this.uow.businessProfiles.findOne({ where: { userId } });
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const where: Record<string, unknown> = { businessId: businessProfile.id };
    if (dto.type) where['type'] = dto.type;
    if (dto.status) where['status'] = dto.status;

    const [transactions, itemCount] = await this.uow.businessTransactions.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: dto.skip,
      take: dto.limit,
    });

    // Render timestamps in the caller's session timezone (captured at login
    // and promoted into the request context by JwtContextMiddleware). The
    // RequestContext middleware also accepts a per-request x-timezone header
    // for unauthenticated routes; for this authenticated endpoint the session
    // value wins. Falls back to UTC when neither was supplied.
    const tz = this.requestContext.timezone ?? 'UTC';

    const data = transactions.map((tx) =>
      plainToInstance(
        TransactionResponseDto,
        {
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          commission_rate: tx.commissionRate,
          commission_amount: tx.commissionAmount,
          total_amount: tx.totalAmount,
          status: tx.status,
          note: tx.note,
          payer_info: this.toPayerInfoResponse(tx.payerInfo),
          created_at: DateUtil.toZonedIso(tx.createdAt, tz),
        },
        { excludeExtraneousValues: true },
      ),
    );

    const meta = new PageMetaDto({ pageOptionsDto: dto, itemCount });

    this.logger.log(
      `listTransactions — complete | count: ${transactions.length}, total: ${itemCount}`,
    );

    return new PageDto(data, meta);
  }

  /** @inheritdoc */
  public async continueTopUp(transactionId: string): Promise<TopUpResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`continueTopUp — start | userId: ${userId}, transactionId: ${transactionId}`);

    const transaction = await this.loadOwnedPendingTopUp(transactionId);

    if (!transaction.processorEventId) {
      this.logger.error(
        `continueTopUp — transaction missing processorEventId | transactionId: ${transactionId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.payment.checkout_failed',
        errorCode: ERROR_CODES.PAYMENT_CHECKOUT_FAILED,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }

    const checkoutSession = await this.paymentService.retrieveCheckoutSession(
      transaction.processorEventId,
    );

    this.logger.log(
      `continueTopUp — complete | transactionId: ${transaction.id}, redirectUrl: ${checkoutSession.processorPaymentUrl}`,
    );

    return plainToInstance(
      TopUpResponseDto,
      {
        transaction_id: transaction.id,
        redirect_url: checkoutSession.processorPaymentUrl,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async cancelTopUp(transactionId: string): Promise<CancelTopUpResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`cancelTopUp — start | userId: ${userId}, transactionId: ${transactionId}`);

    const transaction = await this.loadOwnedPendingTopUp(transactionId);

    // Best-effort provider-side cancellation. Polar throws NotImplementedException
    // (its checkouts auto-expire); other transient errors are also tolerated so the
    // user can always abandon a pending row locally even if the provider is down.
    if (transaction.processorEventId) {
      try {
        await this.paymentService.cancelCheckoutSession(transaction.processorEventId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof NotImplementedException) {
          this.logger.warn(
            `cancelTopUp — provider does not support cancellation, proceeding with local cleanup | transactionId: ${transactionId}, reason: ${message}`,
          );
        } else {
          this.logger.warn(
            `cancelTopUp — provider cancellation failed, proceeding with local cleanup | transactionId: ${transactionId}, error: ${message}`,
          );
        }
      }
    }

    transaction.status = TransactionStatus.FAILED;
    transaction.note = 'Cancelled by user';
    await this.uow.businessTransactions.save(transaction);

    this.logger.log(`cancelTopUp — complete | transactionId: ${transaction.id}`);

    this.eventEmitter.emit(NOTIFICATION_EVENTS.PAYMENT_TOP_UP_REFUNDED, {
      transaction_id: transaction.id,
      transaction_number: transaction.transactionNumber,
      user_id: this.requestContext.userId!,
      amount: parseFloat(transaction.totalAmount),
      currency: Currency.USD,
    });

    // Fire-and-forget email — failure must not fail the cancel response.
    void this.sendCancelTopUpEmail(transaction.transactionNumber, transaction.totalAmount);

    return plainToInstance(
      CancelTopUpResponseDto,
      {
        transaction_id: transaction.id,
        status: transaction.status,
      },
      { excludeExtraneousValues: true },
    );
  }

  private async sendCancelTopUpEmail(transactionNumber: string, amount: string): Promise<void> {
    const userId = this.requestContext.userId!;
    const user = await this.uow.users.findOne({ where: { id: userId } });
    if (!user?.email) return;

    const businessProfile = await this.uow.businessProfiles.findOne({ where: { userId } });

    const cancelDate = DateUtil.format(
      DateUtil.now(this.requestContext.timezone ?? undefined),
      'MMMM D, YYYY',
      this.requestContext.timezone ?? undefined,
    );

    try {
      await this.emailService.sendTopUpCancelledEmail(user.email, {
        recipientName: businessProfile?.companyName ?? 'Business Owner',
        transactionNumber,
        cancelDate,
        amount,
        currency: 'USD',
        transactionsUrl: `${this.env.ployosUrl}/c/${businessProfile?.id}/transactions`,
      });
      this.logger.log(
        `sendCancelTopUpEmail — sent | transactionNumber: ${transactionNumber}, email: ${user.email}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `sendCancelTopUpEmail — failed | transactionNumber: ${transactionNumber}, error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Maps the request-side PayerInfoDto (camelCase post-transform) into the
  // entity column shape. Centralised so createTopUp and settleInvoice persist
  // the same structure; the webhook later overwrites billingAddress in place.
  private toPayerInfoEntity(dto: PayerInfoDto): IPayerInfo {
    return {
      name: dto.name,
      email: dto.email,
      billingAddress: {
        line1: dto.billingAddress.line1,
        line2: dto.billingAddress.line2 ?? null,
        city: dto.billingAddress.city,
        state: dto.billingAddress.state ?? null,
        postalCode: dto.billingAddress.postalCode,
        country: dto.billingAddress.country,
      },
    };
  }

  // Maps the entity column shape to the snake_case response payload. Returns
  // null when the row has no payer info (e.g. internal ledger entries that
  // never go through a Polar checkout).
  private toPayerInfoResponse(payerInfo: IPayerInfo | null): {
    name: string;
    email: string;
    billing_address: {
      line1: string;
      line2: string | null;
      city: string;
      state: string | null;
      postal_code: string;
      country: string;
    };
  } | null {
    if (!payerInfo) return null;
    return {
      name: payerInfo.name,
      email: payerInfo.email,
      billing_address: {
        line1: payerInfo.billingAddress.line1,
        line2: payerInfo.billingAddress.line2,
        city: payerInfo.billingAddress.city,
        state: payerInfo.billingAddress.state,
        postal_code: payerInfo.billingAddress.postalCode,
        country: payerInfo.billingAddress.country,
      },
    };
  }

  // Loads a transaction owned by the calling business, asserting it is a pending
  // top-up. Used by both continueTopUp and cancelTopUp.
  private async loadOwnedPendingTopUp(transactionId: string): Promise<BusinessTransaction> {
    const userId = this.requestContext.userId!;

    const businessProfile = await this.uow.businessProfiles.findOne({ where: { userId } });
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const transaction = await this.uow.businessTransactions.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      this.logger.warn(
        `loadOwnedPendingTopUp — transaction not found | transactionId: ${transactionId}`,
      );
      throw new TranslatableException({
        messageKey: 'error.payment.transaction_not_found',
        errorCode: ERROR_CODES.PAYMENT_TRANSACTION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (transaction.businessId !== businessProfile.id) {
      this.logger.warn(
        `loadOwnedPendingTopUp — caller does not own transaction | transactionId: ${transactionId}, callerBusinessId: ${businessProfile.id}`,
      );
      throw new TranslatableException({
        messageKey: 'error.payment.transaction_not_owned',
        errorCode: ERROR_CODES.PAYMENT_TRANSACTION_NOT_OWNED,
        status: HttpStatus.FORBIDDEN,
      });
    }

    if (
      transaction.type !== BusinessTransactionType.TOP_UP ||
      transaction.status !== TransactionStatus.PENDING
    ) {
      this.logger.warn(
        `loadOwnedPendingTopUp — transaction not a pending top-up | transactionId: ${transactionId}, type: ${transaction.type}, status: ${transaction.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.payment.transaction_not_pending',
        errorCode: ERROR_CODES.PAYMENT_TRANSACTION_NOT_PENDING,
        status: HttpStatus.CONFLICT,
      });
    }

    return transaction;
  }
}
