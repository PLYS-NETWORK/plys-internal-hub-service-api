import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { CreateWithdrawDto } from './dto/requests/create-withdraw.dto';
import { TransactionIdParamDto } from './dto/requests/transaction-id-param.dto';
import { CancelWithdrawResponseDto, WithdrawResponseDto } from './dto/responses';
import { PaymentsService } from './payments.service';
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}
  @Post('withdraw')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Withdraw funds (business or consultant)' })
  public async createWithdraw(
    @Body() dto: CreateWithdrawDto,
  ): Promise<ITranslatedPayload<WithdrawResponseDto>> {
    const data = await this.paymentsService.createWithdraw(dto);
    return { messageKey: 'success.payment.withdraw_initiated', data };
  }
  @Post('withdraw/:transaction_id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending withdrawal and restore account balance' })
  public async cancelWithdraw(
    @Param() params: TransactionIdParamDto,
  ): Promise<ITranslatedPayload<CancelWithdrawResponseDto>> {
    const data = await this.paymentsService.cancelWithdraw(params.transactionId);
    return { messageKey: 'success.payment.withdraw_cancelled', data };
  }
}
