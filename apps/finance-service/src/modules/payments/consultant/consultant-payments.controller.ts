import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { ListConsultantTransactionsDto } from '../dto/requests/list-consultant-transactions.dto';
import { ConsultantTransactionResponseDto } from '../dto/responses';
import { ConsultantPaymentsService } from './consultant-payments.service';
@Controller('payments/consultant')
export class ConsultantPaymentsController {
  constructor(private readonly consultantPaymentsService: ConsultantPaymentsService) {}
  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List own consultant transactions' })
  public async listTransactions(
    @Query() dto: ListConsultantTransactionsDto,
  ): Promise<ITranslatedPayload<PageDto<ConsultantTransactionResponseDto>>> {
    const data = await this.consultantPaymentsService.listTransactions(dto);
    return { messageKey: 'success.ok', data };
  }
}
