import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ActivePlatform } from '@plys/libraries/database/enums';

import { BusinessWithdrawStrategy } from './business/business-withdraw.strategy';
import { ConsultantWithdrawStrategy } from './consultant/consultant-withdraw.strategy';
import { CreateWithdrawDto } from './dto/requests/create-withdraw.dto';
import { CancelWithdrawResponseDto } from './dto/responses/cancel-withdraw-response.dto';
import { WithdrawResponseDto } from './dto/responses/withdraw-response.dto';
import { IWithdrawStrategy } from './shared/withdraw-strategy.interface';

@Injectable()
export class PaymentsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly requestContext: RequestContextService,
    private readonly businessWithdraw: BusinessWithdrawStrategy,
    private readonly consultantWithdraw: ConsultantWithdrawStrategy,
  ) {
    this.logger = new AppLogger(PaymentsService.name, requestContext);
  }

  public async createWithdraw(dto: CreateWithdrawDto): Promise<WithdrawResponseDto> {
    this.logger.log(`createWithdraw — start | amount: ${dto.amount}`);

    const strategy = this.getWithdrawStrategy();
    const result = await strategy.execute(dto.amount, dto.successUrl, dto.cancelUrl);

    this.logger.log(`createWithdraw — complete | is_connected: ${result.is_connected}`);

    return result;
  }

  public async cancelWithdraw(transactionId: string): Promise<CancelWithdrawResponseDto> {
    this.logger.log(`cancelWithdraw — start | transactionId: ${transactionId}`);

    const strategy = this.getWithdrawStrategy();
    const result = await strategy.cancelWithdraw(transactionId);

    this.logger.log(`cancelWithdraw — complete | transactionId: ${transactionId}`);

    return result;
  }

  /**
   * Why Strategy pattern: Business and Consultant use different entities,
   * profile tables, and balance fields. Resolving by activePlatform lets
   * us share a single endpoint while keeping the internal logic separated.
   */
  private getWithdrawStrategy(): IWithdrawStrategy {
    const platform = this.requestContext.activePlatform;

    if (platform === ActivePlatform.BUSINESS) {
      return this.businessWithdraw;
    }

    if (platform === ActivePlatform.CONSULTANT) {
      return this.consultantWithdraw;
    }

    throw new TranslatableException({
      messageKey: 'error.payment.unsupported_platform',
      errorCode: ERROR_CODES.GENERIC_BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
    });
  }
}
