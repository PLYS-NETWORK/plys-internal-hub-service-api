import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_STRICT } from '@plys/libraries/common-nest/constants';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { UserRole } from '@plys/libraries/database/enums';

import { CreateWithdrawDto } from './dto/requests/create-withdraw.dto';
import { TransactionIdParamDto } from './dto/requests/transaction-id-param.dto';
import { CancelWithdrawResponseDto, WithdrawResponseDto } from './dto/responses';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@Throttle(THROTTLE_STRICT)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('withdraw')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Withdraw funds (business or consultant)' })
  public async createWithdraw(
    @Body() dto: CreateWithdrawDto,
  ): Promise<ITranslatedPayload<WithdrawResponseDto>> {
    const data = await this.paymentsService.createWithdraw(dto);
    return { messageKey: 'success.payment.withdraw_initiated', data };
  }

  @Post('withdraw/:transaction_id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Cancel a pending withdrawal and restore account balance' })
  public async cancelWithdraw(
    @Param() params: TransactionIdParamDto,
  ): Promise<ITranslatedPayload<CancelWithdrawResponseDto>> {
    const data = await this.paymentsService.cancelWithdraw(params.transactionId);
    return { messageKey: 'success.payment.withdraw_cancelled', data };
  }
}
