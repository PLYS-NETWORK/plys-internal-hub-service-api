import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminListBusinessTransactionsDto } from '@plys/libraries/api-contracts/payments/dto/requests/admin-list-business-transactions.dto';
import { AdminListConsultantTransactionsDto } from '@plys/libraries/api-contracts/payments/dto/requests/admin-list-consultant-transactions.dto';
import {
  AdminBusinessTransactionResponseDto,
  AdminConsultantTransactionResponseDto,
} from '@plys/libraries/api-contracts/payments/dto/responses';
import { THROTTLE_DEFAULT } from '@plys/libraries/common-nest/constants';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { UserRole } from '@plys/libraries/database/enums';

import { AdminPaymentsService } from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Admin / Payments')
@ApiBearerAuth()
@Controller('finance/admin/payments')
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
