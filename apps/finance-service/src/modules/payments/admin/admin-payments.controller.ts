import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';

import { AdminListBusinessTransactionsDto } from '../dto/requests/admin-list-business-transactions.dto';
import { AdminListConsultantTransactionsDto } from '../dto/requests/admin-list-consultant-transactions.dto';
import {
  AdminBusinessTransactionResponseDto,
  AdminConsultantTransactionResponseDto,
} from '../dto/responses';
import { AdminPaymentsService } from './admin-payments.service';
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly adminPaymentsService: AdminPaymentsService) {}
  @Get('consultant/transactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List consultant transactions across all consultants (paginated, optional filters)',
  })
  public async listConsultantTransactions(
    @Query() dto: AdminListConsultantTransactionsDto,
  ): Promise<ITranslatedPayload<PageDto<AdminConsultantTransactionResponseDto>>> {
    const data = await this.adminPaymentsService.listConsultantTransactions(dto);
    return { messageKey: 'success.ok', data };
  }
  @Get('business/transactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List business transactions across all businesses (paginated, optional filters)',
  })
  public async listBusinessTransactions(
    @Query() dto: AdminListBusinessTransactionsDto,
  ): Promise<ITranslatedPayload<PageDto<AdminBusinessTransactionResponseDto>>> {
    const data = await this.adminPaymentsService.listBusinessTransactions(dto);
    return { messageKey: 'success.ok', data };
  }
}
