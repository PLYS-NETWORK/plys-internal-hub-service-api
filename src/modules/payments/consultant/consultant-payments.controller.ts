import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform } from '@database/enums/active-platform.enum';
import { UserRole } from '@database/enums/user-role.enum';
import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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
    @Query() dto: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<ConsultantTransactionResponseDto>>> {
    const data = await this.consultantPaymentsService.listTransactions(dto);
    return { messageKey: 'success.ok', data };
  }
}
