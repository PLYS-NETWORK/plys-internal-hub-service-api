import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { BusinessProjectHealthDto } from '../../dto/requests/business-project-health.dto';
import { BusinessSpendTrendDto } from '../../dto/requests/business-spend-trend.dto';
import { BusinessTeamPerformanceDto } from '../../dto/requests/business-team-performance.dto';
import {
  BusinessActionItemsResponseDto,
  BusinessDashboardSummaryResponseDto,
  BusinessProjectHealthResponseDto,
  BusinessSpendTrendResponseDto,
  BusinessTeamPerformanceResponseDto,
} from '../../dto/responses';
import {
  BusinessActionItemsService,
  BusinessDashboardSummaryService,
  BusinessProjectHealthService,
  BusinessSpendTrendService,
  BusinessTeamPerformanceService,
} from './services';

@ApiTags('Business / Dashboard')
@ApiBearerAuth()
@Controller('business/dashboard')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class BusinessDashboardController {
  constructor(
    private readonly summary: BusinessDashboardSummaryService,
    private readonly actionItems: BusinessActionItemsService,
    private readonly spendTrend: BusinessSpendTrendService,
    private readonly projectHealth: BusinessProjectHealthService,
    private readonly teamPerformance: BusinessTeamPerformanceService,
  ) {}

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Batched landing-screen KPI snapshot (money, portfolio, throughput, team, action counts)',
  })
  public async getSummary(): Promise<ITranslatedPayload<BusinessDashboardSummaryResponseDto>> {
    const data = await this.summary.get();
    return { messageKey: 'success.ok', data };
  }

  @Get('action-items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Top-5 items per 'needs attention' category (review queue, overdue tasks, disputes, invoices, top-ups)",
  })
  public async getActionItems(): Promise<ITranslatedPayload<BusinessActionItemsResponseDto>> {
    const data = await this.actionItems.get();
    return { messageKey: 'success.ok', data };
  }

  @Get('spend-trend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Time-series of business outflow with running cumulative (defaults to last 6 months, monthly)',
  })
  public async getSpendTrend(
    @Query() dto: BusinessSpendTrendDto,
  ): Promise<ITranslatedPayload<BusinessSpendTrendResponseDto>> {
    const data = await this.spendTrend.get(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get('project-health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Per-project health table (active projects by default), sorted at-risk first',
  })
  public async getProjectHealth(
    @Query() dto: BusinessProjectHealthDto,
  ): Promise<ITranslatedPayload<BusinessProjectHealthResponseDto>> {
    const data = await this.projectHealth.get(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get('team-performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Per-consultant performance table across own projects (defaults to MTD)',
  })
  public async getTeamPerformance(
    @Query() dto: BusinessTeamPerformanceDto,
  ): Promise<ITranslatedPayload<BusinessTeamPerformanceResponseDto>> {
    const data = await this.teamPerformance.get(dto);
    return { messageKey: 'success.ok', data };
  }
}
