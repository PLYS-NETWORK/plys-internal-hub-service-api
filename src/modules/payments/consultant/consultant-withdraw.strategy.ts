import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EnvironmentsService } from '@common/modules/environments';
import { PaymentService } from '@common/modules/payment/payment.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ConsultantTransactionType } from '@database/enums/consultant-transaction-type.enum';
import { TransactionStatus } from '@database/enums/transaction-status.enum';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { WithdrawResponseDto } from '../dto/responses/withdraw-response.dto';
import { IWithdrawStrategy } from '../shared/withdraw-strategy.interface';

@Injectable()
export class ConsultantWithdrawStrategy implements IWithdrawStrategy {
  private readonly logger = new Logger(ConsultantWithdrawStrategy.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly paymentService: PaymentService,
    private readonly env: EnvironmentsService,
  ) {}

  public async execute(amount: number): Promise<WithdrawResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`[${this.rid}] execute — start | userId: ${userId}, amount: ${amount}`);

    const consultantProfile = await this.uow.consultantProfiles.findOne({ where: { userId } });
    if (!consultantProfile) {
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // If Stripe Connect not linked, return onboarding URL
    if (!consultantProfile.stripeConnectAccountId) {
      this.logger.log(
        `[${this.rid}] execute — stripe not connected, returning onboarding URL | consultantId: ${consultantProfile.id}`,
      );

      const redirectUri = `${this.env.ployosUrl}/payments/connect/callback`;
      const onboardingUrl =
        `https://connect.stripe.com/oauth/authorize?` +
        `response_type=code&` +
        `client_id=${this.env.stripeConnectClientId}&` +
        `scope=read_write&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${consultantProfile.id}`;

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
    const currentBalance = parseFloat(consultantProfile.accountBalance);
    if (currentBalance < amount) {
      this.logger.warn(
        `[${this.rid}] execute — insufficient balance | consultantId: ${consultantProfile.id}, balance: ${currentBalance}, requested: ${amount}`,
      );
      throw new TranslatableException({
        messageKey: 'error.payment.insufficient_balance',
        errorCode: ERROR_CODES.PAYMENT_INSUFFICIENT_BALANCE,
        status: HttpStatus.UNPROCESSABLE_ENTITY,
      });
    }

    // Execute withdraw in transaction
    const savedTransaction = await this.uow.withTransaction(async (txUow) => {
      const transaction = txUow.consultantTransactions.create({
        consultantId: consultantProfile.id,
        type: ConsultantTransactionType.WITHDRAWAL,
        amount: amount.toFixed(2),
        status: TransactionStatus.PENDING,
        withdrawalMethod: 'stripe_connect',
        note: 'Withdrawal to connected Stripe account',
      });
      const saved = await txUow.consultantTransactions.save(transaction);

      // Deduct from account balance
      const newBalance = (currentBalance - amount).toFixed(2);
      await txUow.consultantProfiles.update(consultantProfile.id, {
        accountBalance: newBalance,
      });

      try {
        const transferResult = await this.paymentService.createTransfer({
          amount: Math.round(amount * 100),
          currency: 'USD',
          destinationAccountId: consultantProfile.stripeConnectAccountId!,
          transactionId: saved.id,
          description: `Withdrawal for consultant ${consultantProfile.id}`,
        });

        saved.processorEventId = transferResult.processorTransferId;
        saved.withdrawalReference = transferResult.processorTransferId;
        saved.status = TransactionStatus.COMPLETED;
        return await txUow.consultantTransactions.save(saved);
      } catch (error) {
        this.logger.error(
          `[${this.rid}] execute — transfer failed | transactionId: ${saved.id}, error: ${error instanceof Error ? error.message : String(error)}`,
        );

        throw new TranslatableException({
          messageKey: 'error.payment.transfer_failed',
          errorCode: ERROR_CODES.PAYMENT_TRANSFER_FAILED,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
      }
    });

    this.logger.log(`[${this.rid}] execute — complete | transactionId: ${savedTransaction.id}`);

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
