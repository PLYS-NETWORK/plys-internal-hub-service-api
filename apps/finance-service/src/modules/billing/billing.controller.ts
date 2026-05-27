import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE_DEFAULT, THROTTLE_STRICT } from '@plys/libraries/common-nest/constants';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { PageDto } from '@plys/libraries/common-nest/dto/page.dto';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { UserRole } from '@plys/libraries/database/enums';

import { ListBillsDto } from './dto/requests/list-bills.dto';
import { TriggerSettlementDto } from './dto/requests/trigger-settlement.dto';
import { BillDetailResponseDto } from './dto/responses/bill-detail-response.dto';
import { BillListResponseDto } from './dto/responses/bill-list-response.dto';
import { SendBillResponseDto } from './dto/responses/send-bill-response.dto';
import { BillingAdminService } from './services/billing-admin.service';

@ApiTags('Admin - Billing')
@ApiBearerAuth()
@Controller('admin/bills')
@Roles(UserRole.ADMIN_PLATFORM)
@Throttle(THROTTLE_DEFAULT)
export class BillingController {
  constructor(private readonly billingAdmin: BillingAdminService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List billing periods with invoice summary (Admin only)' })
  public async listBills(
    @Query() dto: ListBillsDto,
  ): Promise<ITranslatedPayload<PageDto<BillListResponseDto>>> {
    const data = await this.billingAdmin.listBills(dto);
    return { messageKey: 'success.ok', data };
  }

  @Post('trigger-settlement')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(THROTTLE_STRICT)
  @ApiOperation({
    summary: 'Manually trigger monthly settlement for a given year/month (Admin only)',
  })
  public async triggerSettlement(
    @Body() dto: TriggerSettlementDto,
  ): Promise<ITranslatedPayload<null>> {
    await this.billingAdmin.triggerSettlement(dto);
    return { messageKey: 'success.ok', data: null };
  }

  @Get(':invoiceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get full invoice detail with billing period and line items (Admin only)',
  })
  public async getBillDetail(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<ITranslatedPayload<BillDetailResponseDto>> {
    const data = await this.billingAdmin.getBillDetail(invoiceId);
    return { messageKey: 'success.ok', data };
  }

  @Post(':invoiceId/send')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE_STRICT)
  @ApiOperation({
    summary: 'Manually (re)send the monthly invoice email for a specific bill (Admin only)',
  })
  public async sendBillEmail(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<ITranslatedPayload<SendBillResponseDto>> {
    const data = await this.billingAdmin.sendBillEmail(invoiceId);
    return { messageKey: 'success.ok', data };
  }
}
