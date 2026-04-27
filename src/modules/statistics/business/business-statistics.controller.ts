import { Platform } from '@common/decorators/platform.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { PlatformGuard } from '@common/guards/platform.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { ITranslatedPayload } from '@common/interceptors/transform-response.interceptor';
import { ActivePlatform, UserRole } from '@database/enums';
import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PendingApplicationsDto } from '../dto/requests/pending-applications.dto';
import { ProjectsTrendDto } from '../dto/requests/projects-trend.dto';
import { StatsDateRangeDto } from '../dto/requests/stats-date-range.dto';
import { ApplicationFunnelResponseDto } from '../dto/responses/application-funnel-response.dto';
import { ApplicationsPerProjectResponseDto } from '../dto/responses/applications-per-project-response.dto';
import { BillingDraftRatioResponseDto } from '../dto/responses/billing-draft-ratio-response.dto';
import { BillingSpendTrendResponseDto } from '../dto/responses/billing-spend-trend-response.dto';
import { BillingSummaryResponseDto } from '../dto/responses/billing-summary-response.dto';
import { DashboardSummaryResponseDto } from '../dto/responses/dashboard-summary-response.dto';
import { PendingApplicationsResponseDto } from '../dto/responses/pending-applications-response.dto';
import { ProjectInterviewStatsResponseDto } from '../dto/responses/project-interview-stats-response.dto';
import { ProjectStatsResponseDto } from '../dto/responses/project-stats-response.dto';
import { ProjectTrendResponseDto } from '../dto/responses/project-trend-response.dto';
import { TaskStatsResponseDto } from '../dto/responses/task-stats-response.dto';
import { TasksCompletionResponseDto } from '../dto/responses/tasks-completion-response.dto';
import { TasksOverdueResponseDto } from '../dto/responses/tasks-overdue-response.dto';
import { BusinessApplicationStatisticsService } from './services/business-application-statistics.service';
import { BusinessBillingStatisticsService } from './services/business-billing-statistics.service';
import { BusinessDashboardSummaryService } from './services/business-dashboard-summary.service';
import { BusinessProjectStatisticsService } from './services/business-project-statistics.service';
import { BusinessTaskStatisticsService } from './services/business-task-statistics.service';

@ApiTags('Statistics - Business')
@ApiBearerAuth()
@Controller('statistics-business')
@UseGuards(RolesGuard, PlatformGuard)
@Roles(UserRole.USER)
@Platform(ActivePlatform.BUSINESS)
export class BusinessStatisticsController {
  constructor(
    private readonly projectStats: BusinessProjectStatisticsService,
    private readonly taskStats: BusinessTaskStatisticsService,
    private readonly applicationStats: BusinessApplicationStatisticsService,
    private readonly billingStats: BusinessBillingStatisticsService,
    private readonly dashboardSummary: BusinessDashboardSummaryService,
  ) {}

  // ─── Projects ──────────────────────────────────────────────────────────────

  @Get('projects/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Project counts grouped by lifecycle status (donut chart + KPI)' })
  public async getProjectStats(
    @Query() query: StatsDateRangeDto,
  ): Promise<ITranslatedPayload<ProjectStatsResponseDto>> {
    const data = await this.projectStats.getStats(query);
    return { messageKey: 'success.ok', data };
  }

  @Get('projects/trend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Project creation/publish counts grouped by week or month' })
  public async getProjectTrend(
    @Query() query: ProjectsTrendDto,
  ): Promise<ITranslatedPayload<ProjectTrendResponseDto>> {
    const data = await this.projectStats.getTrend(query);
    return { messageKey: 'success.ok', data };
  }

  @Get('projects/interview-stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Interview-question adoption stats across own projects' })
  public async getProjectInterviewStats(): Promise<
    ITranslatedPayload<ProjectInterviewStatsResponseDto>
  > {
    const data = await this.projectStats.getInterviewStats();
    return { messageKey: 'success.ok', data };
  }

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  @Get('tasks/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Task counts grouped by Kanban status across own projects' })
  public async getTaskStats(
    @Query() query: StatsDateRangeDto,
  ): Promise<ITranslatedPayload<TaskStatsResponseDto>> {
    const data = await this.taskStats.getStats(query);
    return { messageKey: 'success.ok', data };
  }

  @Get('tasks/overdue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Total + per-project overdue task counts' })
  public async getOverdueTasks(
    @Query() query: StatsDateRangeDto,
  ): Promise<ITranslatedPayload<TasksOverdueResponseDto>> {
    const data = await this.taskStats.getOverdue(query);
    return { messageKey: 'success.ok', data };
  }

  @Get('tasks/completion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Per-project task completion rates, sorted desc' })
  public async getTasksCompletion(
    @Query() query: StatsDateRangeDto,
  ): Promise<ITranslatedPayload<TasksCompletionResponseDto>> {
    const data = await this.taskStats.getCompletion(query);
    return { messageKey: 'success.ok', data };
  }

  // ─── Applications ──────────────────────────────────────────────────────────

  @Get('applications/funnel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consultant application funnel (applied → reviewed → approved → active)',
  })
  public async getApplicationFunnel(
    @Query() query: StatsDateRangeDto,
  ): Promise<ITranslatedPayload<ApplicationFunnelResponseDto>> {
    const data = await this.applicationStats.getFunnel(query);
    return { messageKey: 'success.ok', data };
  }

  @Get('applications/per-project')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Applications per project, split by status' })
  public async getApplicationsPerProject(
    @Query() query: StatsDateRangeDto,
  ): Promise<ITranslatedPayload<ApplicationsPerProjectResponseDto>> {
    const data = await this.applicationStats.getPerProject(query);
    return { messageKey: 'success.ok', data };
  }

  @Get('applications/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paginated list of pending applications across own projects' })
  public async getPendingApplications(
    @Query() query: PendingApplicationsDto,
  ): Promise<ITranslatedPayload<PendingApplicationsResponseDto>> {
    const data = await this.applicationStats.getPending(query);
    return { messageKey: 'success.ok', data };
  }

  // ─── Billing ───────────────────────────────────────────────────────────────

  @Get('billing/summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Total spend, distinct paid projects, last payment timestamp' })
  public async getBillingSummary(): Promise<ITranslatedPayload<BillingSummaryResponseDto>> {
    const data = await this.billingStats.getSummary();
    return { messageKey: 'success.ok', data };
  }

  @Get('billing/spend-trend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Monthly publishing spend with running cumulative total' })
  public async getSpendTrend(
    @Query() query: StatsDateRangeDto,
  ): Promise<ITranslatedPayload<BillingSpendTrendResponseDto>> {
    const data = await this.billingStats.getSpendTrend(query);
    return { messageKey: 'success.ok', data };
  }

  @Get('billing/draft-ratio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Draft vs published split + estimated potential revenue' })
  public async getDraftRatio(): Promise<ITranslatedPayload<BillingDraftRatioResponseDto>> {
    const data = await this.billingStats.getDraftRatio();
    return { messageKey: 'success.ok', data };
  }

  // ─── Dashboard Summary (Batched) ──────────────────────────────────────────

  @Get('dashboard/summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batched payload for the four KPI stat cards' })
  public async getDashboardSummary(): Promise<ITranslatedPayload<DashboardSummaryResponseDto>> {
    const data = await this.dashboardSummary.get();
    return { messageKey: 'success.ok', data };
  }
}
