import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ListConsultantTransactionsDto } from '@plys/libraries/api-contracts/payments/dto/requests/list-consultant-transactions.dto';
import { ConsultantTransactionResponseDto } from '@plys/libraries/api-contracts/payments/dto/responses';
import { THROTTLE_DEFAULT } from '@plys/libraries/common-nest/constants';
import { Platform } from '@plys/libraries/common-nest/decorators/platform.decorator';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';

import { ConsultantPaymentsService } from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Consultant Payments')
@ApiBearerAuth()
@Controller('finance/payments/consultant')
@Throttle(THROTTLE_DEFAULT)
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
