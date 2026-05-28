import { HttpStatus, Injectable } from '@nestjs/common';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { DateUtil } from '@plys/libraries/common-nest/utils/date';
import { Currency, ProjectStatus, TaskKanbanStatus } from '@plys/libraries/database/enums';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ERROR_CODES } from '../../../../../errors/error-codes';
import { BusinessDashboardSummaryResponseDto } from '../../../dto/responses/business-dashboard-summary-response.dto';
import {
  BUSINESS_DASHBOARD_CACHE_KEYS,
  BUSINESS_DASHBOARD_CACHE_TTL_SECONDS,
} from '../../constants';
import { IBusinessDashboardSummaryService } from '../interfaces/business-dashboard-summary-service.interface';

const ACTIVE_PROJECT_STATUSES: readonly ProjectStatus[] = [
  ProjectStatus.PUBLISHED,
  ProjectStatus.IN_PROGRESS,
];

@Injectable()
export class BusinessDashboardSummaryService implements IBusinessDashboardSummaryService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(BusinessDashboardSummaryService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(): Promise<BusinessDashboardSummaryResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`get — start | userId: ${userId}`);

    const businessProfile = await this.uow.businessProfiles.findByUserId(userId);
    if (!businessProfile) {
      this.logger.warn(`get — business profile not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    const businessId = businessProfile.id;

    const cacheKey = BUSINESS_DASHBOARD_CACHE_KEYS.summary(businessId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`get — cache hit | businessId: ${businessId}`);
      return plainToInstance(
        BusinessDashboardSummaryResponseDto,
        JSON.parse(cached) as Record<string, unknown>,
        { excludeExtraneousValues: true },
      );
    }

    const now = new Date();
    const mtdStart = DateUtil.toDate(DateUtil.startOf(now, 'month'));
    // Project IDs are the universe for every task-side aggregate; fetch once
    // alongside the active set so the at-risk calc has both.
    const [projectIds, activeProjects] = await Promise.all([
      this.uow.projects.findIdsByBusinessId(businessId),
      this.uow.projects.findActiveByBusinessId(businessId, 1000),
    ]);
    const activeProjectIds = new Set(activeProjects.map((p) => p.id));

    // Single parallel fan-out for the remaining aggregates.
    const [
      portfolioByStatus,
      mtdSpend,
      projectedBill,
      outstandingAmount,
      outstandingCount,
      unpublishedPipeline,
      tasksByStatus,
      tasksCompletedMtd,
      tasksOverdue,
      avgCycleDays,
      onTime,
      activeConsultants,
      newConsultantsMtd,
      pendingTopUps,
      openDisputes,
      overdueInvoices,
      overdueByProject,
    ] = await Promise.all([
      this.uow.projects.countByBusinessIdGroupedByStatus(businessId),
      this.uow.businessTransactions.sumBusinessOutflowBetween(businessId, mtdStart, now),
      this.uow.businessTransactions.sumProjectedMonthlyBillByBusinessId(businessId),
      this.uow.invoices.sumOutstandingAmountByBusinessId(businessId),
      this.uow.invoices.countOutstandingByBusinessId(businessId),
      this.uow.tasks.sumUnpublishedTaskPricesByBusinessId(businessId),
      this.uow.tasks.countByProjectIdsGroupedByStatus(projectIds),
      this.uow.tasks.countCompletedByProjectIdsBetween(projectIds, mtdStart, now),
      this.uow.tasks.countOverdueByProjectIds(projectIds),
      this.uow.tasks.avgCycleDaysByProjectIdsBetween(projectIds, mtdStart, now),
      this.uow.tasks.countOnTimeByProjectIdsBetween(projectIds, mtdStart, now),
      this.uow.projectMembers.countDistinctActiveConsultantsByProjectIds(projectIds),
      this.uow.projectMembers.countDistinctNewConsultantsByProjectIdsBetween(
        projectIds,
        mtdStart,
        now,
      ),
      this.uow.businessTransactions.countPendingTopUpsByBusinessId(businessId),
      this.uow.taskDisputes.countOpenByBusinessId(businessId),
      this.uow.invoices.findOverdueByBusinessId(businessId, 1000),
      this.uow.tasks.countOverdueByProjectIdsGroupedByProject(projectIds),
    ]);

    const totalProjects = Object.values(portfolioByStatus).reduce((sum, n) => sum + n, 0);
    const activeProjectsCount = ACTIVE_PROJECT_STATUSES.reduce(
      (sum, s) => sum + portfolioByStatus[s],
      0,
    );
    const completedProjects = portfolioByStatus[ProjectStatus.DONE];
    const atRiskCount = overdueByProject.filter(
      (r) => r.overdue_count > 0 && activeProjectIds.has(r.project_id),
    ).length;

    const onTimePct = onTime.total > 0 ? ((onTime.onTime / onTime.total) * 100).toFixed(1) : null;
    const avgCycleStr = avgCycleDays !== null ? avgCycleDays.toFixed(1) : null;
    const tasksInReview = tasksByStatus[TaskKanbanStatus.IN_REVIEW];

    const payload = {
      money: {
        currency: Currency.USD,
        wallet_balance: businessProfile.accountBalance,
        mtd_spend: mtdSpend,
        projected_monthly_bill: projectedBill,
        outstanding_invoices_amount: outstandingAmount,
        outstanding_invoices_count: outstandingCount,
        unpublished_pipeline_value: unpublishedPipeline,
      },
      portfolio: {
        total_projects: totalProjects,
        active_projects: activeProjectsCount,
        completed_projects: completedProjects,
        at_risk_count: atRiskCount,
      },
      throughput: {
        tasks_completed_mtd: tasksCompletedMtd,
        tasks_in_review: tasksInReview,
        tasks_overdue: tasksOverdue,
        avg_cycle_days: avgCycleStr,
        on_time_delivery_pct: onTimePct,
      },
      team: {
        active_consultants: activeConsultants,
        new_consultants_mtd: newConsultantsMtd,
      },
      action_counts: {
        tasks_awaiting_review: tasksInReview,
        overdue_tasks: tasksOverdue,
        open_disputes: openDisputes,
        overdue_invoices: overdueInvoices.length,
        pending_topups: pendingTopUps,
      },
      generated_at: now.toISOString(),
    };

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(payload),
        BUSINESS_DASHBOARD_CACHE_TTL_SECONDS.summary,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `get — cache set failed | error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(
      `get — complete | businessId: ${businessId}, total_projects: ${totalProjects}, mtd_spend: ${mtdSpend}, in_review: ${tasksInReview}`,
    );

    return plainToInstance(BusinessDashboardSummaryResponseDto, payload, {
      excludeExtraneousValues: true,
    });
  }
}
