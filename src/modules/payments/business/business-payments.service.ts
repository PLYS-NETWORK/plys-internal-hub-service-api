import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { PaymentService } from '@common/modules/payment/payment.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import {
  BusinessTransactionType,
  CheckoutPaymentType,
  Currency,
  InvoiceStatus,
  PaymentProcessor,
  TransactionStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { CreateTopUpDto } from '../dto/requests/create-top-up.dto';
import { ListBusinessTransactionsDto } from '../dto/requests/list-business-transactions.dto';
import { SettleInvoiceDto } from '../dto/requests/settle-invoice.dto';
import {
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
  ) {
    this.logger = new AppLogger(BusinessPaymentsService.name, requestContext);
  }

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

    // Create pending transaction
    const transaction = this.uow.businessTransactions.create({
      businessId: businessProfile.id,
      type: BusinessTransactionType.TOP_UP,
      amount: dto.amount.toFixed(2),
      status: TransactionStatus.PENDING,
      note: 'Top-up via payment checkout',
    });
    const savedTransaction = await this.uow.businessTransactions.save(transaction);

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
      });

      // Save processor IDs on invoice for tracking
      invoice.processorName = PaymentProcessor.POLAR;
      invoice.processorInvoiceId = checkoutSession.processorInvoiceId;
      invoice.processorPaymentIntentId = checkoutSession.processorPaymentIntentId;
      invoice.processorPaymentUrl = checkoutSession.processorPaymentUrl;
      await this.uow.invoices.save(invoice);

      // Save processor event ID on business transaction
      businessTxn.processorEventId = checkoutSession.processorInvoiceId;
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

    const data = transactions.map((tx) =>
      plainToInstance(
        TransactionResponseDto,
        {
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          status: tx.status,
          note: tx.note,
          created_at: tx.createdAt,
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
}
