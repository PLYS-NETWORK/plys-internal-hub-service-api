import { ERROR_CODES } from '@common/constants/error-codes';
import { PageDto } from '@common/dto/page.dto';
import { PageMetaDto } from '@common/dto/page-meta.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EnvironmentsService } from '@common/modules/environments';
import { PaymentService } from '@common/modules/payment/payment.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { BusinessTransactionType } from '@database/enums/business-transaction-type.enum';
import { TransactionStatus } from '@database/enums/transaction-status.enum';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { CreateTopUpDto } from './dto/requests/create-top-up.dto';
import { CreateWithdrawDto } from './dto/requests/create-withdraw.dto';
import {
  ConnectStatusResponseDto,
  TopUpResponseDto,
  TransactionResponseDto,
  WithdrawResponseDto,
} from './dto/responses';
import { IBusinessPaymentsService } from './interfaces/business-payments-service.interface';

@Injectable()
export class BusinessPaymentsService implements IBusinessPaymentsService {
  private readonly logger = new Logger(BusinessPaymentsService.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly paymentService: PaymentService,
    private readonly env: EnvironmentsService,
  ) {}

  public async createTopUp(dto: CreateTopUpDto): Promise<TopUpResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] createTopUp — start | userId: ${userId}, amount: ${dto.amount}`);

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

    // Create checkout session with Polar
    try {
      const checkoutSession = await this.paymentService.createCheckoutSession({
        invoiceId: savedTransaction.id,
        amount: Math.round(dto.amount * 100), // Convert to cents
        currency: 'USD',
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
        externalProductId: this.env.polarTopUpProductId,
        metadata: {
          transactionId: savedTransaction.id,
          businessId: businessProfile.id,
          type: 'top_up',
        },
      });

      // Update transaction with processor details
      savedTransaction.processorEventId = checkoutSession.processorInvoiceId;
      await this.uow.businessTransactions.save(savedTransaction);

      this.logger.log(
        `[${this.rid}] createTopUp — complete | transactionId: ${savedTransaction.id}, redirectUrl: ${checkoutSession.processorPaymentUrl}`,
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
      // Mark transaction as failed if checkout creation fails
      savedTransaction.status = TransactionStatus.FAILED;
      savedTransaction.note = 'Checkout session creation failed';
      await this.uow.businessTransactions.save(savedTransaction);

      this.logger.error(
        `[${this.rid}] createTopUp — failed | transactionId: ${savedTransaction.id}, error: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw new TranslatableException({
        messageKey: 'error.payment.checkout_failed',
        errorCode: ERROR_CODES.PAYMENT_CHECKOUT_FAILED,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  public async listTransactions(dto: PageOptionsDto): Promise<PageDto<TransactionResponseDto>> {
    const userId = this.requestContext.userId!;
    this.logger.log(
      `[${this.rid}] listTransactions — start | userId: ${userId}, page: ${dto.page}, limit: ${dto.limit}`,
    );

    const businessProfile = await this.uow.businessProfiles.findOne({ where: { userId } });
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const [transactions, itemCount] = await this.uow.businessTransactions.findAndCount({
      where: { businessId: businessProfile.id },
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
      `[${this.rid}] listTransactions — complete | count: ${transactions.length}, total: ${itemCount}`,
    );

    return new PageDto(data, meta);
  }

  public async createWithdraw(dto: CreateWithdrawDto): Promise<WithdrawResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(
      `[${this.rid}] createWithdraw — start | userId: ${userId}, amount: ${dto.amount}`,
    );

    const businessProfile = await this.uow.businessProfiles.findOne({ where: { userId } });
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // Check if Stripe Connect account is linked
    if (!businessProfile.stripeConnectAccountId) {
      this.logger.warn(
        `[${this.rid}] createWithdraw — stripe not connected | businessId: ${businessProfile.id}`,
      );
      throw new TranslatableException({
        messageKey: 'error.payment.stripe_not_connected',
        errorCode: ERROR_CODES.PAYMENT_STRIPE_NOT_CONNECTED,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // Validate sufficient balance
    const currentBalance = parseFloat(businessProfile.accountBalance);
    if (currentBalance < dto.amount) {
      this.logger.warn(
        `[${this.rid}] createWithdraw — insufficient balance | businessId: ${businessProfile.id}, balance: ${currentBalance}, requested: ${dto.amount}`,
      );
      throw new TranslatableException({
        messageKey: 'error.payment.insufficient_balance',
        errorCode: ERROR_CODES.PAYMENT_INSUFFICIENT_BALANCE,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // Execute withdraw in transaction
    const savedTransaction = await this.uow.withTransaction(async (txUow) => {
      // Create withdraw transaction
      const transaction = txUow.businessTransactions.create({
        businessId: businessProfile.id,
        type: BusinessTransactionType.WITHDRAW,
        amount: dto.amount.toFixed(2),
        status: TransactionStatus.PENDING,
        note: 'Withdrawal to connected Stripe account',
      });
      const saved = await txUow.businessTransactions.save(transaction);

      // Deduct from account balance
      const newBalance = (currentBalance - dto.amount).toFixed(2);
      await txUow.businessProfiles.update(businessProfile.id, {
        accountBalance: newBalance,
      });

      // Create transfer via Stripe
      try {
        const transferResult = await this.paymentService.createTransfer({
          amount: Math.round(dto.amount * 100), // Convert to cents
          currency: 'USD',
          destinationAccountId: businessProfile.stripeConnectAccountId!,
          transactionId: saved.id,
          description: `Withdrawal for business ${businessProfile.id}`,
        });

        // Update transaction with processor details and mark as completed
        saved.processorEventId = transferResult.processorTransferId;
        saved.status = TransactionStatus.COMPLETED;
        return await txUow.businessTransactions.save(saved);
      } catch (error) {
        this.logger.error(
          `[${this.rid}] createWithdraw — transfer failed | transactionId: ${saved.id}, error: ${error instanceof Error ? error.message : String(error)}`,
        );

        // Mark as failed but keep the deduction rolled back via transaction
        throw new TranslatableException({
          messageKey: 'error.payment.transfer_failed',
          errorCode: ERROR_CODES.PAYMENT_TRANSFER_FAILED,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
      }
    });

    this.logger.log(
      `[${this.rid}] createWithdraw — complete | transactionId: ${savedTransaction.id}`,
    );

    return plainToInstance(
      WithdrawResponseDto,
      {
        transaction_id: savedTransaction.id,
        status: savedTransaction.status,
      },
      { excludeExtraneousValues: true },
    );
  }

  public async initiateConnect(): Promise<ConnectStatusResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] initiateConnect — start | userId: ${userId}`);

    const businessProfile = await this.uow.businessProfiles.findOne({ where: { userId } });
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // If already connected, return status
    if (businessProfile.stripeConnectAccountId) {
      return plainToInstance(
        ConnectStatusResponseDto,
        {
          is_connected: true,
          account_id: businessProfile.stripeConnectAccountId,
          onboarding_url: null,
        },
        { excludeExtraneousValues: true },
      );
    }

    // Build Stripe Connect OAuth URL
    // Note: This is a simplified implementation. In production, you'd use
    // Stripe's OAuth flow with proper state management for security.
    const redirectUri = `${this.env.ployosUrl}/payments/connect/callback`;
    const onboardingUrl =
      `https://connect.stripe.com/oauth/authorize?` +
      `response_type=code&` +
      `client_id=${this.env.stripeConnectClientId}&` +
      `scope=read_write&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${businessProfile.id}`;

    this.logger.log(`[${this.rid}] initiateConnect — complete | businessId: ${businessProfile.id}`);

    return plainToInstance(
      ConnectStatusResponseDto,
      {
        is_connected: false,
        account_id: null,
        onboarding_url: onboardingUrl,
      },
      { excludeExtraneousValues: true },
    );
  }

  public async getConnectStatus(): Promise<ConnectStatusResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] getConnectStatus — start | userId: ${userId}`);

    const businessProfile = await this.uow.businessProfiles.findOne({ where: { userId } });
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const isConnected = !!businessProfile.stripeConnectAccountId;

    this.logger.log(
      `[${this.rid}] getConnectStatus — complete | businessId: ${businessProfile.id}, isConnected: ${isConnected}`,
    );

    return plainToInstance(
      ConnectStatusResponseDto,
      {
        is_connected: isConnected,
        account_id: businessProfile.stripeConnectAccountId,
        onboarding_url: null,
      },
      { excludeExtraneousValues: true },
    );
  }
}
