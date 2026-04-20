import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PageDto } from '@common/dto/page.dto';
import { PageOptionsDto } from '@common/dto/page-options.dto';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform } from '@database/enums/active-platform.enum';
import { UserRole } from '@database/enums/user-role.enum';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { BusinessPaymentsService } from './business-payments.service';
import { CreateTopUpDto } from './dto/requests/create-top-up.dto';
import { CreateWithdrawDto } from './dto/requests/create-withdraw.dto';
import {
  ConnectStatusResponseDto,
  TopUpResponseDto,
  TransactionResponseDto,
  WithdrawResponseDto,
} from './dto/responses';

@ApiTags('Business Payments')
@ApiBearerAuth()
@Controller('business-payments')
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

  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.BUSINESS)
  @ApiOperation({ summary: 'List own transactions' })
  public async listTransactions(
    @Query() dto: PageOptionsDto,
  ): Promise<ITranslatedPayload<PageDto<TransactionResponseDto>>> {
    const data = await this.businessPaymentsService.listTransactions(dto);
    return { messageKey: 'success.ok', data };
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.BUSINESS)
  @ApiOperation({ summary: 'Request withdrawal to connected Stripe account' })
  public async createWithdraw(
    @Body() dto: CreateWithdrawDto,
  ): Promise<ITranslatedPayload<WithdrawResponseDto>> {
    const data = await this.businessPaymentsService.createWithdraw(dto);
    return { messageKey: 'success.payment.withdraw_completed', data };
  }

  @Post('connect')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.BUSINESS)
  @ApiOperation({ summary: 'Initiate Stripe Connect onboarding' })
  public async initiateConnect(): Promise<ITranslatedPayload<ConnectStatusResponseDto>> {
    const data = await this.businessPaymentsService.initiateConnect();
    return { messageKey: 'success.payment.connect_initiated', data };
  }

  @Get('connect/status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard, PlatformGuard)
  @Roles(UserRole.USER)
  @Platform(ActivePlatform.BUSINESS)
  @ApiOperation({ summary: 'Check Stripe Connect account status' })
  public async getConnectStatus(): Promise<ITranslatedPayload<ConnectStatusResponseDto>> {
    const data = await this.businessPaymentsService.getConnectStatus();
    return { messageKey: 'success.ok', data };
  }
}
