import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { Currency } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { AdminDashboardSummaryResponseDto } from '../../dto/responses/admin-dashboard-summary-response.dto';
import { ADMIN_DASHBOARD_CACHE_KEYS, ADMIN_DASHBOARD_CACHE_TTL_SECONDS } from '../constants';
import { IAdminDashboardSummaryService } from '../interfaces/admin-dashboard-summary-service.interface';

@Injectable()
export class AdminDashboardSummaryService implements IAdminDashboardSummaryService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(AdminDashboardSummaryService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(): Promise<AdminDashboardSummaryResponseDto> {
    this.logger.log('get — start');

    const cached = await this.redis.get(ADMIN_DASHBOARD_CACHE_KEYS.SUMMARY);
    if (cached) {
      this.logger.log('get — cache hit | source: redis');
      return plainToInstance(
        AdminDashboardSummaryResponseDto,
        JSON.parse(cached) as Record<string, unknown>,
        { excludeExtraneousValues: true },
      );
    }

    const now = new Date();
    const mtdStart = DateUtil.toDate(DateUtil.startOf(now, 'month'));
    const prevMonthRef = DateUtil.subtract(now, 1, 'month').toDate();
    const prevMonthStart = DateUtil.toDate(DateUtil.startOf(prevMonthRef, 'month'));
    const prevMonthEnd = DateUtil.toDate(DateUtil.endOf(prevMonthRef, 'month'));

    // Eight independent reads, all run in parallel. No read-after-read deps.
    const [
      usersBreakdown,
      newUsersMtd,
      mtdGmv,
      mtdPayouts,
      outstandingPayouts,
      outstandingInvoices,
      prevMonthGmv,
      prevMonthPayouts,
      onboardings,
      exams,
      disputes,
      overdueInvoices,
      pendingWithdrawals,
    ] = await Promise.all([
      this.uow.users.countByPlatformGroupedByStatus(),
      this.uow.users.countNewByPlatformBetween(mtdStart, now),
      this.uow.businessTransactions.sumGmvBetween(mtdStart, now),
      this.uow.consultantTransactions.sumPayoutsBetween(mtdStart, now),
      this.uow.consultantProfiles.sumAccountBalances(),
      this.uow.invoices.sumOutstandingAmount(),
      this.uow.businessTransactions.sumGmvBetween(prevMonthStart, prevMonthEnd),
      this.uow.consultantTransactions.sumPayoutsBetween(prevMonthStart, prevMonthEnd),
      this.uow.consultantOnboardings.countPendingReview(),
      this.uow.consultantSkillExams.countAwaitingReview(),
      this.uow.taskDisputes.countOpen(),
      this.uow.invoices.countOverdue(),
      this.uow.consultantTransactions.countPendingWithdrawals(),
    ]);

    const payload = {
      users: usersBreakdown,
      financial: {
        currency: Currency.USD,
        mtd_gmv: mtdGmv,
        mtd_payouts: mtdPayouts,
        outstanding_payouts: outstandingPayouts,
        outstanding_invoices: outstandingInvoices,
      },
      queues: {
        pending_consultant_onboardings: onboardings,
        skill_exams_awaiting_review: exams,
        open_task_disputes: disputes,
        overdue_invoices: overdueInvoices,
        pending_consultant_withdrawals: pendingWithdrawals,
      },
      growth: {
        new_consultants_mtd: newUsersMtd.consultant,
        new_businesses_mtd: newUsersMtd.business,
        gmv_delta_pct: this.computeDeltaPct(mtdGmv, prevMonthGmv),
        payouts_delta_pct: this.computeDeltaPct(mtdPayouts, prevMonthPayouts),
      },
      generated_at: now.toISOString(),
    };

    try {
      await this.redis.set(
        ADMIN_DASHBOARD_CACHE_KEYS.SUMMARY,
        JSON.stringify(payload),
        ADMIN_DASHBOARD_CACHE_TTL_SECONDS,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `get — cache set failed | error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(
      `get — complete | businesses: ${usersBreakdown.business.total}, consultants: ${usersBreakdown.consultant.total}, mtd_gmv: ${mtdGmv}, mtd_payouts: ${mtdPayouts}`,
    );

    return plainToInstance(AdminDashboardSummaryResponseDto, payload, {
      excludeExtraneousValues: true,
    });
  }

  // Returns the percentage change `(current - previous) / previous * 100`,
  // rounded to one decimal place, as a string. Special cases:
  //   prev = 0, curr = 0 → "0.0"
  //   prev = 0, curr > 0 → "100.0" (treat as fully new; avoids Infinity)
  // Emitted as a string for JSON-number stability (matches commission_rate
  // convention used elsewhere in the codebase).
  private computeDeltaPct(currentStr: string, previousStr: string): string {
    const current = Number(currentStr);
    const previous = Number(previousStr);
    if (previous === 0) {
      return current === 0 ? '0.0' : '100.0';
    }
    const pct = ((current - previous) / previous) * 100;
    return pct.toFixed(1);
  }
}
