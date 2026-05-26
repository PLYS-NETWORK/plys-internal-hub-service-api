import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { BusinessActionItemsResponseDto } from '../../../dto/responses/business-action-items-response.dto';
import {
  BUSINESS_DASHBOARD_ACTION_ITEMS_LIMIT,
  BUSINESS_DASHBOARD_CACHE_KEYS,
  BUSINESS_DASHBOARD_CACHE_TTL_SECONDS,
} from '../../constants';
import { IBusinessActionItemsService } from '../interfaces/business-action-items-service.interface';

@Injectable()
export class BusinessActionItemsService implements IBusinessActionItemsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(BusinessActionItemsService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(): Promise<BusinessActionItemsResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`get — start | userId: ${userId}`);

    const businessProfile = await this.uow.businessProfiles.findByUserId(userId);
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    const businessId = businessProfile.id;

    const cacheKey = BUSINESS_DASHBOARD_CACHE_KEYS.actionItems(businessId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`get — cache hit | businessId: ${businessId}`);
      return plainToInstance(
        BusinessActionItemsResponseDto,
        JSON.parse(cached) as Record<string, unknown>,
        { excludeExtraneousValues: true },
      );
    }

    const projectIds = await this.uow.projects.findIdsByBusinessId(businessId);
    const limit = BUSINESS_DASHBOARD_ACTION_ITEMS_LIMIT;

    const [
      awaitingReview,
      awaitingReviewTotal,
      overdueTasks,
      overdueTasksTotal,
      openDisputes,
      openDisputesTotal,
      overdueInvoices,
      overdueInvoicesTotal,
      pendingTopUps,
      pendingTopUpsTotal,
    ] = await Promise.all([
      this.uow.tasks.findAwaitingReviewByProjectIds(projectIds, limit),
      this.countAwaitingReviewTotal(projectIds),
      this.uow.tasks.findOverdueByProjectIds(projectIds, limit),
      this.uow.tasks.countOverdueByProjectIds(projectIds),
      this.uow.taskDisputes.findOpenByBusinessId(businessId, limit),
      this.uow.taskDisputes.countOpenByBusinessId(businessId),
      this.uow.invoices.findOverdueByBusinessId(businessId, limit),
      // The action-items category surfaces overdue specifically. The summary
      // endpoint reports the same number; we use the same source here.
      this.uow.invoices.findOverdueByBusinessId(businessId, 1000).then((rows) => rows.length),
      this.uow.businessTransactions.findPendingTopUpsByBusinessId(businessId, limit),
      this.uow.businessTransactions.countPendingTopUpsByBusinessId(businessId),
    ]);

    const payload = {
      tasks_awaiting_review: {
        total: awaitingReviewTotal,
        items: awaitingReview.map((r) => ({
          task_id: r.task_id,
          task_code: r.task_code,
          title: r.title,
          project_id: r.project_id,
          project_title: r.project_title,
          submitted_at: r.reference_at.toISOString(),
        })),
      },
      overdue_tasks: {
        total: overdueTasksTotal,
        items: overdueTasks.map((r) => ({
          task_id: r.task_id,
          task_code: r.task_code,
          title: r.title,
          project_id: r.project_id,
          project_title: r.project_title,
          submitted_at: r.reference_at.toISOString(),
          due_date: r.reference_at.toISOString(),
          days_overdue: r.days_overdue ?? 0,
        })),
      },
      open_disputes: {
        total: openDisputesTotal,
        items: openDisputes.map((r) => ({
          dispute_id: r.dispute_id,
          task_id: r.task_id,
          task_code: r.task_code,
          reason_snippet: r.reason_snippet,
          opened_at: r.opened_at.toISOString(),
        })),
      },
      overdue_invoices: {
        total: overdueInvoicesTotal,
        items: overdueInvoices.map((r) => ({
          invoice_id: r.invoice_id,
          amount: r.amount,
          due_date: r.due_date.toISOString(),
          days_overdue: r.days_overdue,
        })),
      },
      pending_topups: {
        total: pendingTopUpsTotal,
        items: pendingTopUps.map((r) => ({
          transaction_id: r.transaction_id,
          transaction_number: r.transaction_number,
          total_amount: r.total_amount,
          created_at: r.created_at.toISOString(),
          redirect_url: r.redirect_url,
        })),
      },
      generated_at: new Date().toISOString(),
    };

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(payload),
        BUSINESS_DASHBOARD_CACHE_TTL_SECONDS.actionItems,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `get — cache set failed | error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(
      `get — complete | review: ${awaitingReviewTotal}, overdue_tasks: ${overdueTasksTotal}, disputes: ${openDisputesTotal}, invoices: ${overdueInvoicesTotal}, top_ups: ${pendingTopUpsTotal}`,
    );

    return plainToInstance(BusinessActionItemsResponseDto, payload, {
      excludeExtraneousValues: true,
    });
  }

  // No dedicated count method for IN_REVIEW exists yet; reuse the
  // status-grouped aggregate (single query) and read out the bucket.
  private async countAwaitingReviewTotal(projectIds: string[]): Promise<number> {
    if (projectIds.length === 0) return 0;
    const byStatus = await this.uow.tasks.countByProjectIdsGroupedByStatus(projectIds);
    return byStatus['in_review' as keyof typeof byStatus] ?? 0;
  }
}
