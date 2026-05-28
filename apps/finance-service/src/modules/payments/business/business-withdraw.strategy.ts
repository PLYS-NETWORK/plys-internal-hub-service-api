import { HttpStatus, Injectable } from '@nestjs/common';
import { NOTIFICATION_EVENTS } from '@plys/libraries/common-nest/events';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { EmailService } from '@plys/libraries/common-nest/modules/email/email.service';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { NotificationsClientService } from '@plys/libraries/common-nest/modules/notifications-client/notifications-client.service';
import { PaymentService } from '@plys/libraries/common-nest/modules/payment/payment.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { DateUtil } from '@plys/libraries/common-nest/utils/date';
import {
  BusinessTransactionType,
  Currency,
  TransactionStatus,
} from '@plys/libraries/database/enums';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ERROR_CODES } from '../../../errors/error-codes';
import { CancelWithdrawResponseDto } from '../dto/responses/cancel-withdraw-response.dto';
import { WithdrawResponseDto } from '../dto/responses/withdraw-response.dto';
import { IWithdrawStrategy } from '../shared/withdraw-strategy.interface';

@Injectable()
export class BusinessWithdrawStrategy implements IWithdrawStrategy {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly paymentService: PaymentService,
    private readonly env: EnvironmentsService,
    private readonly notificationsClient: NotificationsClientService,
    private readonly emailService: EmailService,
  ) {
    this.logger = new AppLogger(BusinessWithdrawStrategy.name, requestContext);
  }

  /** @inheritdoc */
  public async execute(
    amount: number,
    successUrl: string,
    cancelUrl: string,
  ): Promise<WithdrawResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`execute — start | userId: ${userId}, amount: ${amount}`);

    const businessProfile = await this.uow.businessProfiles.findOne({ where: { userId } });
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // If Stripe Connect not linked, return onboarding URL
    if (!businessProfile.stripeConnectAccountId) {
      this.logger.log(
        `execute — stripe not connected, returning onboarding URL | businessId: ${businessProfile.id}`,
      );

      // Encode profileId + redirect URLs in state so the frontend callback can
      // redirect the user to the correct page after OAuth completes.
      const state = encodeURIComponent(
        JSON.stringify({ profileId: businessProfile.id, successUrl, cancelUrl }),
      );
      const redirectUri = `${this.env.ployosUrl}/payments/connect/callback`;
      const onboardingUrl =
        `https://connect.stripe.com/oauth/authorize?` +
        `response_type=code&` +
        `client_id=${this.env.stripeConnectClientId}&` +
        `scope=read_write&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}`;

      return plainToInstance(
        WithdrawResponseDto,
        {
          is_connected: false,
          onboarding_url: onboardingUrl,
          transaction_id: null,
          status: null,
        },
        { excludeExtraneousValues: true },
      );
    }

    // Validate sufficient balance
    const currentBalance = parseFloat(businessProfile.accountBalance);
    if (currentBalance < amount) {
      this.logger.warn(
        `execute — insufficient balance | businessId: ${businessProfile.id}, balance: ${currentBalance}, requested: ${amount}`,
      );
      throw new TranslatableException({
        messageKey: 'error.payment.insufficient_balance',
        errorCode: ERROR_CODES.PAYMENT_INSUFFICIENT_BALANCE,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // Execute withdraw in transaction
    const amountStr = amount.toFixed(2);
    const savedTransaction = await this.uow.withTransaction(async (txUow) => {
      const transactionNumber = await txUow.transactionNumbers.next(
        'PLS',
        BusinessTransactionType.WITHDRAW,
      );
      const transaction = txUow.businessTransactions.create({
        transactionNumber,
        businessId: businessProfile.id,
        type: BusinessTransactionType.WITHDRAW,
        amount: amountStr,
        totalAmount: amountStr,
        status: TransactionStatus.PENDING,
        note: 'Withdrawal to connected Stripe account',
      });
      const saved = await txUow.businessTransactions.save(transaction);

      // Deduct from account balance
      const newBalance = (currentBalance - amount).toFixed(2);
      await txUow.businessProfiles.update(businessProfile.id, {
        accountBalance: newBalance,
      });

      try {
        const transferResult = await this.paymentService.createTransfer({
          amount: Math.round(amount * 100),
          currency: Currency.USD,
          destinationAccountId: businessProfile.stripeConnectAccountId!,
          transactionId: saved.id,
          description: `Withdrawal for business ${businessProfile.id}`,
        });

        saved.processorEventId = transferResult.processorTransferId;
        saved.status = TransactionStatus.COMPLETED;
        return await txUow.businessTransactions.save(saved);
      } catch (error) {
        this.logger.error(
          `execute — transfer failed | transactionId: ${saved.id}, error: ${error instanceof Error ? error.message : String(error)}`,
        );

        throw new TranslatableException({
          messageKey: 'error.payment.transfer_failed',
          errorCode: ERROR_CODES.PAYMENT_TRANSFER_FAILED,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
      }
    });

    this.logger.log(`execute — complete | transactionId: ${savedTransaction.id}`);

    // Fire-and-forget — only fires for terminal-completed withdrawals. Failed
    // transfers throw inside the transaction (rolled back) so we won't reach
    // here for a non-COMPLETED status.
    if (savedTransaction.status === TransactionStatus.COMPLETED) {
      const newBalance = (currentBalance - amount).toFixed(2);
      this.notificationsClient.emit(NOTIFICATION_EVENTS.PAYMENT_WITHDRAW_COMPLETED, {
        transaction_id: savedTransaction.id,
        transaction_number: savedTransaction.transactionNumber,
        user_id: userId,
        amount,
        currency: 'USD',
        new_balance: parseFloat(newBalance),
      });
    }

    return plainToInstance(
      WithdrawResponseDto,
      {
        is_connected: true,
        onboarding_url: null,
        transaction_id: savedTransaction.id,
        status: savedTransaction.status,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async cancelWithdraw(transactionId: string): Promise<CancelWithdrawResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`cancelWithdraw — start | userId: ${userId}, transactionId: ${transactionId}`);

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
      this.logger.warn(`cancelWithdraw — transaction not found | transactionId: ${transactionId}`);
      throw new TranslatableException({
        messageKey: 'error.payment.transaction_not_found',
        errorCode: ERROR_CODES.PAYMENT_TRANSACTION_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (transaction.businessId !== businessProfile.id) {
      this.logger.warn(
        `cancelWithdraw — caller does not own transaction | transactionId: ${transactionId}, callerBusinessId: ${businessProfile.id}`,
      );
      throw new TranslatableException({
        messageKey: 'error.payment.transaction_not_owned',
        errorCode: ERROR_CODES.PAYMENT_TRANSACTION_NOT_OWNED,
        status: HttpStatus.FORBIDDEN,
      });
    }

    if (
      transaction.type !== BusinessTransactionType.WITHDRAW ||
      transaction.status !== TransactionStatus.PENDING
    ) {
      this.logger.warn(
        `cancelWithdraw — transaction not a pending withdrawal | transactionId: ${transactionId}, type: ${transaction.type}, status: ${transaction.status}`,
      );
      throw new TranslatableException({
        messageKey: 'error.payment.transaction_not_pending',
        errorCode: ERROR_CODES.PAYMENT_TRANSACTION_NOT_PENDING,
        status: HttpStatus.CONFLICT,
      });
    }

    const restoredAmount = transaction.totalAmount;

    await this.uow.withTransaction(async (txUow) => {
      transaction.status = TransactionStatus.FAILED;
      transaction.note = 'Cancelled by user — payment gateway closed';
      await txUow.businessTransactions.save(transaction);

      const newBalance = (
        parseFloat(businessProfile.accountBalance) + parseFloat(restoredAmount)
      ).toFixed(2);
      await txUow.businessProfiles.update(businessProfile.id, { accountBalance: newBalance });
    });

    this.logger.log(
      `cancelWithdraw — complete | transactionId: ${transactionId}, restoredAmount: ${restoredAmount}`,
    );

    this.notificationsClient.emit(NOTIFICATION_EVENTS.PAYMENT_WITHDRAW_REVERSED, {
      transaction_id: transaction.id,
      transaction_number: transaction.transactionNumber,
      user_id: userId,
      amount: parseFloat(restoredAmount),
      currency: 'USD',
      new_balance: parseFloat(businessProfile.accountBalance) + parseFloat(restoredAmount),
      reason: 'Cancelled by user',
    });

    // Fire-and-forget email
    void this.sendCancelEmail(
      businessProfile.userId,
      transaction.transactionNumber,
      restoredAmount,
    );

    return plainToInstance(
      CancelWithdrawResponseDto,
      {
        transaction_id: transaction.id,
        status: transaction.status,
        restored_amount: restoredAmount,
      },
      { excludeExtraneousValues: true },
    );
  }

  private async sendCancelEmail(
    userId: string,
    transactionNumber: string,
    restoredAmount: string,
  ): Promise<void> {
    const user = await this.uow.users.findOne({ where: { id: userId } });
    if (!user?.email) return;

    const businessProfile = await this.uow.businessProfiles.findOne({ where: { userId } });

    const cancelDate = DateUtil.format(
      DateUtil.now(this.requestContext.timezone ?? undefined),
      'MMMM D, YYYY',
      this.requestContext.timezone ?? undefined,
    );

    try {
      await this.emailService.sendWithdrawCancelledEmail(user.email, {
        recipientName: businessProfile?.companyName ?? 'Business Owner',
        transactionNumber,
        cancelDate,
        restoredAmount,
        currency: 'USD',
        transactionsUrl: `${this.env.ployosUrl}/billing/transactions`,
      });
      this.logger.log(
        `cancelWithdraw — email sent | transactionNumber: ${transactionNumber}, email: ${user.email}`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `cancelWithdraw — email failed | transactionNumber: ${transactionNumber}, error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
