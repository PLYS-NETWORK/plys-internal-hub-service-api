import { THROTTLE_DEFAULT } from '@common/constants';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { UserRole } from '@database/enums';
import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AdminListBusinessTransactionsDto } from '../dto/requests/admin-list-business-transactions.dto';
import { AdminListConsultantTransactionsDto } from '../dto/requests/admin-list-consultant-transactions.dto';
import {
  AdminBusinessTransactionResponseDto,
  AdminConsultantTransactionResponseDto,
} from '../dto/responses';
import { AdminPaymentsService } from './admin-payments.service';

@ApiTags('Admin / Payments')
@ApiBearerAuth()
@Controller('admin/payments')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN_PLATFORM)
@Throttle(THROTTLE_DEFAULT)
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
