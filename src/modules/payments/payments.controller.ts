import { HEADERS } from '@common/constants';
import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { UserRole } from '@database/enums';
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateWithdrawDto } from './dto/requests/create-withdraw.dto';
import { WithdrawResponseDto } from './dto/responses/withdraw-response.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@ApiHeader({ name: HEADERS.X_DEVICE_ID, required: false, description: 'Unique device identifier for session binding' })
@Controller('payments')
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
}
