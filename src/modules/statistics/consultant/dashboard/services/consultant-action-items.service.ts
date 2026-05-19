import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ConsultantActionItemsResponseDto } from '../../../dto/responses/consultant-action-items-response.dto';
import {
  CONSULTANT_DASHBOARD_ACTION_ITEMS_LIMIT,
  CONSULTANT_DASHBOARD_CACHE_KEYS,
  CONSULTANT_DASHBOARD_CACHE_TTL_SECONDS,
} from '../constants';
import { IConsultantActionItemsService } from '../interfaces/consultant-action-items-service.interface';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class ConsultantActionItemsService implements IConsultantActionItemsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantActionItemsService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(): Promise<ConsultantActionItemsResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`get — start | userId: ${userId}`);

    const consultantProfile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!consultantProfile) {
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    const consultantId = consultantProfile.id;

    const cacheKey = CONSULTANT_DASHBOARD_CACHE_KEYS.actionItems(consultantId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`get — cache hit | consultantId: ${consultantId}`);
      return plainToInstance(
        ConsultantActionItemsResponseDto,
        JSON.parse(cached) as Record<string, unknown>,
        { excludeExtraneousValues: true },
      );
    }

    const limit = CONSULTANT_DASHBOARD_ACTION_ITEMS_LIMIT;
    const now = new Date();

    const [
      revisionRequestedItems,
      revisionRequestedTotal,
      overdueItems,
      overdueTotal,
      pendingApprovalItems,
      tasksByStatus,
      unreadNotificationItems,
      unreadNotificationTotal,
      pendingWithdrawals,
      pendingWithdrawalsTotal,
    ] = await Promise.all([
      this.uow.tasks.findRevisionRequestedByAssignee(consultantId, limit),
      this.uow.tasks.countRevisionRequestedByAssignee(consultantId),
      this.uow.tasks.findOverdueByAssignee(consultantId, limit),
      this.uow.tasks.countOverdueByAssignee(consultantId),
      this.uow.tasks.findAwaitingBusinessApprovalByAssignee(consultantId, limit),
      this.uow.tasks.countByAssigneeGroupedByStatus(consultantId),
      this.uow.notifications.findRecentUnreadByUserId(userId, limit),
      this.uow.notifications.countUnreadByUserId(userId),
      this.uow.consultantTransactions.findPendingWithdrawalsByConsultantId(consultantId, limit),
      this.uow.consultantTransactions.countPendingWithdrawalsByConsultantId(consultantId),
    ]);

    const pendingApprovalTotal =
      tasksByStatus[TaskKanbanStatus.IN_REVIEW] + tasksByStatus[TaskKanbanStatus.PENDING_APPROVAL];

    const payload = {
      revision_requested_tasks: {
        total: revisionRequestedTotal,
        items: revisionRequestedItems.map((r) => ({
          task_id: r.task_id,
          task_code: r.task_code,
          title: r.title,
          project_id: r.project_id,
          project_title: r.project_title,
          kanban_status: r.kanban_status,
          due_date: r.due_date ? r.due_date.toISOString() : null,
          last_revision_requested_at: r.updated_at.toISOString(),
        })),
      },
      overdue_tasks: {
        total: overdueTotal,
        items: overdueItems.map((r) => ({
          task_id: r.task_id,
          task_code: r.task_code,
          title: r.title,
          project_id: r.project_id,
          project_title: r.project_title,
          kanban_status: r.kanban_status,
          due_date: (r.due_date as Date).toISOString(),
          days_overdue: r.days_overdue ?? 0,
        })),
      },
      pending_approval_tasks: {
        total: pendingApprovalTotal,
        items: pendingApprovalItems.map((r) => ({
          task_id: r.task_id,
          task_code: r.task_code,
          title: r.title,
          project_id: r.project_id,
          project_title: r.project_title,
          kanban_status: r.kanban_status,
          submitted_at: r.updated_at.toISOString(),
          days_waiting: Math.max(
            0,
            Math.floor((now.getTime() - r.updated_at.getTime()) / MS_PER_DAY),
          ),
        })),
      },
      recent_notifications: {
        total: unreadNotificationTotal,
        items: unreadNotificationItems.map((n) => ({
          notification_id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          redirect_url: n.redirectUrl,
          created_at: n.createdAt.toISOString(),
        })),
      },
      pending_withdrawals: {
        total: pendingWithdrawalsTotal,
        items: pendingWithdrawals.map((r) => ({
          transaction_id: r.transaction_id,
          transaction_number: r.transaction_number,
          amount: r.amount,
          withdrawal_method: r.withdrawal_method,
          created_at: r.created_at.toISOString(),
        })),
      },
      generated_at: now.toISOString(),
    };

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(payload),
        CONSULTANT_DASHBOARD_CACHE_TTL_SECONDS.actionItems,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `get — cache set failed | error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(
      `get — complete | revisions: ${revisionRequestedTotal}, overdue: ${overdueTotal}, pending_approval: ${pendingApprovalTotal}, unread: ${unreadNotificationTotal}, pending_wd: ${pendingWithdrawalsTotal}`,
    );

    return plainToInstance(ConsultantActionItemsResponseDto, payload, {
      excludeExtraneousValues: true,
    });
  }
}
