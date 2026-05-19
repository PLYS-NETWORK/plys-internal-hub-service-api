import { THROTTLE_INTERACTIVE } from '@common/constants';
import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ConsultantEarningsTrendDto } from '../../dto/requests/consultant-earnings-trend.dto';
import { ConsultantProjectProgressDto } from '../../dto/requests/consultant-project-progress.dto';
import { ConsultantSkillPerformanceDto } from '../../dto/requests/consultant-skill-performance.dto';
import {
  ConsultantActionItemsResponseDto,
  ConsultantDashboardSummaryResponseDto,
  ConsultantEarningsTrendResponseDto,
  ConsultantProjectProgressResponseDto,
  ConsultantSkillPerformanceResponseDto,
} from '../../dto/responses';
import {
  ConsultantActionItemsService,
  ConsultantDashboardSummaryService,
  ConsultantEarningsTrendService,
  ConsultantProjectProgressService,
  ConsultantSkillPerformanceService,
} from './services';

@ApiTags('Consultant / Dashboard')
@ApiBearerAuth()
@Controller('consultant/dashboard')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.CONSULTANT)
@Throttle(THROTTLE_INTERACTIVE)
export class ConsultantDashboardController {
  constructor(
    private readonly summary: ConsultantDashboardSummaryService,
    private readonly actionItems: ConsultantActionItemsService,
    private readonly earningsTrend: ConsultantEarningsTrendService,
    private readonly projectProgress: ConsultantProjectProgressService,
    private readonly skillPerformance: ConsultantSkillPerformanceService,
  ) {}

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Batched landing-screen KPI snapshot (money, portfolio, performance, skills, exams, onboarding, action counts)',
  })
  public async getSummary(): Promise<ITranslatedPayload<ConsultantDashboardSummaryResponseDto>> {
    const data = await this.summary.get();
    return { messageKey: 'success.ok', data };
  }

  @Get('action-items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Top-5 items per 'needs attention' category (revisions, overdue, pending approval, notifications, withdrawals)",
  })
  public async getActionItems(): Promise<ITranslatedPayload<ConsultantActionItemsResponseDto>> {
    const data = await this.actionItems.get();
    return { messageKey: 'success.ok', data };
  }

  @Get('earnings-trend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Time-series of consultant earnings/pending/withdrawals with running cumulative (defaults to last 6 months, monthly)',
  })
  public async getEarningsTrend(
    @Query() dto: ConsultantEarningsTrendDto,
  ): Promise<ITranslatedPayload<ConsultantEarningsTrendResponseDto>> {
    const data = await this.earningsTrend.get(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get('project-progress')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Per-project progress table for the consultant's active engagements, sorted at-risk first",
  })
  public async getProjectProgress(
    @Query() dto: ConsultantProjectProgressDto,
  ): Promise<ITranslatedPayload<ConsultantProjectProgressResponseDto>> {
    const data = await this.projectProgress.get(dto);
    return { messageKey: 'success.ok', data };
  }

  @Get('skill-performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Per-skill performance table for the consultant (sortable by completed_tasks / earnings / rating)',
  })
  public async getSkillPerformance(
    @Query() dto: ConsultantSkillPerformanceDto,
  ): Promise<ITranslatedPayload<ConsultantSkillPerformanceResponseDto>> {
    const data = await this.skillPerformance.get(dto);
    return { messageKey: 'success.ok', data };
  }
}
