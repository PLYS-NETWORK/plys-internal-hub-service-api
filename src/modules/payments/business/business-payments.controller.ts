import { THROTTLE_DEFAULT, THROTTLE_STRICT } from '@common/constants';
import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CreateTopUpDto } from '../dto/requests/create-top-up.dto';
import { ListBusinessTransactionsDto } from '../dto/requests/list-business-transactions.dto';
import { SettleInvoiceDto } from '../dto/requests/settle-invoice.dto';
import { TransactionIdParamDto } from '../dto/requests/transaction-id-param.dto';
import {
  CancelTopUpResponseDto,
  SettleInvoiceResponseDto,
  TopUpResponseDto,
  TransactionResponseDto,
} from '../dto/responses';
import { BusinessPaymentsService } from './business-payments.service';

@ApiTags('Business Payments')
@ApiBearerAuth()
@Controller('payments/business')
@Throttle(THROTTLE_STRICT)
export class BusinessPaymentsController {
  constructor(private readonly businessPaymentsService: BusinessPaymentsService) {}

  @Post('top-up')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.BUSINESS)
  @ApiOperation({ summary: 'Initiate account top-up' })
  public async createTopUp(
    @Body() dto: CreateTopUpDto,
  ): Promise<ITranslatedPayload<TopUpResponseDto>> {
    const data = await this.businessPaymentsService.createTopUp(dto);
    return { messageKey: 'success.payment.top_up_initiated', data };
  }

  @Post('top-up/:transaction_id/continue')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.BUSINESS)
  @ApiOperation({ summary: 'Resume a pending top-up by re-fetching the checkout URL' })
  public async continueTopUp(
    @Param() params: TransactionIdParamDto,
  ): Promise<ITranslatedPayload<TopUpResponseDto>> {
    const data = await this.businessPaymentsService.continueTopUp(params.transactionId);
    return { messageKey: 'success.payment.top_up_resumed', data };
  }

  @Post('top-up/:transaction_id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.BUSINESS)
  @ApiOperation({ summary: 'Cancel a pending top-up without waiting for gateway timeout' })
  public async cancelTopUp(
    @Param() params: TransactionIdParamDto,
  ): Promise<ITranslatedPayload<CancelTopUpResponseDto>> {
    const data = await this.businessPaymentsService.cancelTopUp(params.transactionId);
    return { messageKey: 'success.payment.top_up_cancelled', data };
  }

  @Post('settle-invoice')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.BUSINESS)
  @ApiOperation({ summary: 'Initiate payment for a billing invoice' })
  public async settleInvoice(
    @Body() dto: SettleInvoiceDto,
  ): Promise<ITranslatedPayload<SettleInvoiceResponseDto>> {
    const data = await this.businessPaymentsService.settleInvoice(dto);
    return { messageKey: 'success.billing.invoice_checkout_initiated', data };
  }

  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.BUSINESS)
  @Throttle(THROTTLE_DEFAULT)
  @ApiOperation({ summary: 'List own transactions' })
  public async listTransactions(
    @Query() dto: ListBusinessTransactionsDto,
  ): Promise<ITranslatedPayload<PageDto<TransactionResponseDto>>> {
    const data = await this.businessPaymentsService.listTransactions(dto);
    return { messageKey: 'success.ok', data };
  }
}
