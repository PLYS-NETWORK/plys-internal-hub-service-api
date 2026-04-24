import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ListConsultantTransactionsDto } from '../dto/requests/list-consultant-transactions.dto';
import { ConsultantTransactionResponseDto } from '../dto/responses';
import { ConsultantPaymentsService } from './consultant-payments.service';

@ApiTags('Consultant Payments')
@ApiBearerAuth()
@Controller('payments/consultant')
export class ConsultantPaymentsController {
  constructor(private readonly consultantPaymentsService: ConsultantPaymentsService) {}

  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.CONSULTANT)
  @ApiOperation({ summary: 'List own consultant transactions' })
  public async listTransactions(
    @Query() dto: ListConsultantTransactionsDto,
  ): Promise<ITranslatedPayload<PageDto<ConsultantTransactionResponseDto>>> {
    const data = await this.consultantPaymentsService.listTransactions(dto);
    return { messageKey: 'success.ok', data };
  }
}
