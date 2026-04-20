import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';

import { CreateTopUpDto } from '../dto/requests/create-top-up.dto';
import { CreateWithdrawDto } from '../dto/requests/create-withdraw.dto';
import {
  ConnectStatusResponseDto,
  TopUpResponseDto,
  TransactionResponseDto,
  WithdrawResponseDto,
} from '../dto/responses';

export interface IBusinessPaymentsService {
  /**
   * Creates a top-up transaction and returns a redirect URL for payment.
   */
  createTopUp(dto: CreateTopUpDto): Promise<TopUpResponseDto>;

  /**
   * Lists transactions for the current business user.
   */
  listTransactions(dto: PageOptionsDto): Promise<PageDto<TransactionResponseDto>>;

  /**
   * Creates a withdrawal transaction and initiates transfer via Stripe Connect.
   * Requires the business to have a connected Stripe account.
   */
  createWithdraw(dto: CreateWithdrawDto): Promise<WithdrawResponseDto>;

  /**
   * Initiates Stripe Connect onboarding and returns the OAuth URL.
   */
  initiateConnect(): Promise<ConnectStatusResponseDto>;

  /**
   * Checks the current Stripe Connect account status.
   */
  getConnectStatus(): Promise<ConnectStatusResponseDto>;
}
