import { Injectable } from '@nestjs/common';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { AdminOperationalQueuesResponseDto } from '../../dto/responses/admin-operational-queues-response.dto';
import { ADMIN_DASHBOARD_CACHE_KEYS, ADMIN_DASHBOARD_CACHE_TTL_SECONDS } from '../constants';
import { IAdminOperationalQueuesService } from '../interfaces/admin-operational-queues-service.interface';

@Injectable()
export class AdminOperationalQueuesService implements IAdminOperationalQueuesService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(AdminOperationalQueuesService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(): Promise<AdminOperationalQueuesResponseDto> {
    this.logger.log('get — start');

    const cached = await this.redis.get(ADMIN_DASHBOARD_CACHE_KEYS.QUEUES);
    if (cached) {
      this.logger.log('get — cache hit | source: redis');
      return plainToInstance(
        AdminOperationalQueuesResponseDto,
        JSON.parse(cached) as Record<string, unknown>,
        { excludeExtraneousValues: true },
      );
    }

    const counts = await this.computeCounts();
    const payload = {
      counts,
      generated_at: new Date().toISOString(),
    };

    // Best-effort cache write. Failure to set doesn't block the response —
    // the next request will recompute and try again.
    try {
      await this.redis.set(
        ADMIN_DASHBOARD_CACHE_KEYS.QUEUES,
        JSON.stringify(payload),
        ADMIN_DASHBOARD_CACHE_TTL_SECONDS,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `get — cache set failed | error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(
      `get — complete | onboardings: ${counts.pending_consultant_onboardings}, exams: ${counts.skill_exams_awaiting_review}, disputes: ${counts.open_task_disputes}, overdue: ${counts.overdue_invoices}, withdrawals: ${counts.pending_consultant_withdrawals}`,
    );

    return plainToInstance(AdminOperationalQueuesResponseDto, payload, {
      excludeExtraneousValues: true,
    });
  }

  // Fans out the five queue counts in parallel.
  private async computeCounts(): Promise<{
    pending_consultant_onboardings: number;
    skill_exams_awaiting_review: number;
    open_task_disputes: number;
    overdue_invoices: number;
    pending_consultant_withdrawals: number;
  }> {
    const [onboardings, exams, disputes, overdueInvoices, pendingWithdrawals] = await Promise.all([
      this.uow.consultantOnboardings.countPendingReview(),
      this.uow.consultantSkillExams.countAwaitingReview(),
      this.uow.taskDisputes.countOpen(),
      this.uow.invoices.countOverdue(),
      this.uow.consultantTransactions.countPendingWithdrawals(),
    ]);

    return {
      pending_consultant_onboardings: onboardings,
      skill_exams_awaiting_review: exams,
      open_task_disputes: disputes,
      overdue_invoices: overdueInvoices,
      pending_consultant_withdrawals: pendingWithdrawals,
    };
  }
}
