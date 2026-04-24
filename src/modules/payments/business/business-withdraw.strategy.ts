import { AppLogger } from '@common/modules/logger';
import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EnvironmentsService } from '@common/modules/environments';
import { PaymentService } from '@common/modules/payment/payment.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { BusinessTransactionType } from '@database/enums/business-transaction-type.enum';
import { TransactionStatus } from '@database/enums/transaction-status.enum';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

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
  ) {
    this.logger = new AppLogger(BusinessWithdrawStrategy.name, requestContext);
  }

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
    const savedTransaction = await this.uow.withTransaction(async (txUow) => {
      const transaction = txUow.businessTransactions.create({
        businessId: businessProfile.id,
        type: BusinessTransactionType.WITHDRAW,
        amount: amount.toFixed(2),
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
          currency: 'USD',
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
}
