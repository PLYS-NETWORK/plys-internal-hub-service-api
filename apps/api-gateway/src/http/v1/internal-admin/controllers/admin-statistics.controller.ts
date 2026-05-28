import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminGrowthTrendDto } from '@plys/libraries/api-contracts/statistics/dto/requests/admin-growth-trend.dto';
import {
  AdminDashboardSummaryResponseDto,
  AdminGrowthTrendResponseDto,
  AdminOperationalQueuesResponseDto,
  AdminUsersBreakdownResponseDto,
} from '@plys/libraries/api-contracts/statistics/dto/responses';
import { THROTTLE_INTERACTIVE } from '@plys/libraries/common-nest/constants';
import { Roles } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { UserRole } from '@plys/libraries/database/enums';

import {
  AdminDashboardSummaryService,
  AdminGrowthTrendService,
  AdminOperationalQueuesService,
  AdminUsersBreakdownService,
} from '@/http/v1/shared/grpc-service-tokens';

@ApiTags('Admin / Dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN_PLATFORM)
@Throttle(THROTTLE_INTERACTIVE)
export class AdminStatisticsController {
  constructor(
    private readonly summary: AdminDashboardSummaryService,
    private readonly usersBreakdown: AdminUsersBreakdownService,
    private readonly growthTrend: AdminGrowthTrendService,
    private readonly operationalQueues: AdminOperationalQueuesService,
  ) {}

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Batched cross-platform KPI snapshot (users, financial, queues, growth deltas)',
  })
  public async getSummary(): Promise<ITranslatedPayload<AdminDashboardSummaryResponseDto>> {
    const data = await this.summary.get();
    return { messageKey: 'success.ok', data };
  }

  @Get('users-breakdown')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Per-platform user counts split by status (active / unverified / banned / inactive)',
  })
  public async getUsersBreakdown(): Promise<ITranslatedPayload<AdminUsersBreakdownResponseDto>> {
    const data = await this.usersBreakdown.get();
    return { messageKey: 'success.ok', data };
  }

  @Get('growth-trend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aligned signups + GMV + payouts time series (defaults to last 6 months, monthly)',
  })
  public async getGrowthTrend(
    @Query() dto: AdminGrowthTrendDto,
  ): Promise<ITranslatedPayload<AdminGrowthTrendResponseDto>> {
    const data = await this.growthTrend.get(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get('operational-queues')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Counts of items needing human attention (pending onboardings, exams, disputes, overdue invoices, withdrawals)',
  })
  public async getOperationalQueues(): Promise<
    ITranslatedPayload<AdminOperationalQueuesResponseDto>
  > {
    const data = await this.operationalQueues.get();
    return { messageKey: 'success.ok', data };
  }
}
