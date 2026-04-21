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

import { CreateTopUpDto } from '../dto/requests/create-top-up.dto';
import { TopUpResponseDto, TransactionResponseDto } from '../dto/responses';
import { BusinessPaymentsService } from './business-payments.service';

@ApiTags('Business Payments')
@ApiBearerAuth()
@Controller('payments/business')
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
}
