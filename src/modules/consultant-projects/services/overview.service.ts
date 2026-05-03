import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { ProjectPaymentType, TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ConsultantOverviewResponseDto } from '../dto/responses';
import {
  IConsultantOverviewByStatus,
  IConsultantOverviewCompletedTask,
  IConsultantOverviewNextPayment,
  IConsultantOverviewPaymentHistoryItem,
} from '../dto/responses/interfaces/consultant-overview.response.interface';
import { IConsultantOverviewService } from '../interfaces/consultant-overview.service.interface';
import { ConsultantAccessService } from './consultant-access.service';

// USD until projects gain a per-currency column. Documented in plan §10.6.
const DEFAULT_CURRENCY = 'USD';

// Platform pays out monthly invoices on the 5th of the following month.
// Documented in plan §10.4 and aligns with BillingSettlementService cadence.
const PER_MONTH_PAYOUT_DAY = 5;

@Injectable()
export class ConsultantOverviewService implements IConsultantOverviewService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: ConsultantAccessService,
  ) {
    this.logger = new AppLogger(ConsultantOverviewService.name, requestContext);
  }

  /** @inheritdoc */
  public async getOverview(projectId: string): Promise<ConsultantOverviewResponseDto> {
    const { project, consultantProfile, member } =
      await this.access.resolveProjectMembership(projectId);
    const consultantId = consultantProfile.id;
    this.logger.log(
      `getOverview — start | projectId: ${projectId}, consultantId: ${consultantId}, paymentType: ${project.paymentType}`,
    );

    const isPerMonth = project.paymentType === ProjectPaymentType.PER_MONTH;

    // Run the read-only aggregations in parallel; the per-task / per-month
    // branches diverge only in which list we materialise.
    const [byStatus, earnings, completedTasks, paymentHistory] = await Promise.all([
      this.uow.tasks.countByAssigneeAndProjectGroupedByStatus(consultantId, projectId),
      this.uow.consultantTransactions.sumEarningsByConsultantAndProject(consultantId, projectId),
      isPerMonth
        ? Promise.resolve([])
        : this.uow.consultantTransactions.findCompletedTasksByConsultantAndProject(
            consultantId,
            projectId,
          ),
      isPerMonth
        ? this.uow.consultantTransactions.findPaymentHistoryByConsultantAndProject(
            consultantId,
            projectId,
          )
        : Promise.resolve([]),
    ]);

    const totalAssigned = this.sumByStatus(byStatus);
    const completionRate =
      totalAssigned === 0
        ? 0
        : Math.round((byStatus[TaskKanbanStatus.DONE] / totalAssigned) * 100) / 100;

    const earningsBlock: {
      total_earned: number;
      currency: string;
      pending_amount?: number;
      completed_tasks?: IConsultantOverviewCompletedTask[];
      payment_history?: IConsultantOverviewPaymentHistoryItem[];
    } = {
      total_earned: earnings.totalEarned,
      currency: DEFAULT_CURRENCY,
    };

    let nextPayment: IConsultantOverviewNextPayment | undefined;
    if (isPerMonth) {
      earningsBlock.payment_history = paymentHistory;
      const lastPaidAt = paymentHistory.length > 0 ? paymentHistory[0].paid_at : null;
      const lastAmount = paymentHistory.length > 0 ? paymentHistory[0].amount : 0;
      nextPayment = this.computeNextPayment(lastPaidAt, lastAmount);
    } else {
      earningsBlock.pending_amount = earnings.pendingAmount;
      earningsBlock.completed_tasks = this.toCompletedTasks(completedTasks);
    }

    this.logger.log(
      `getOverview — complete | projectId: ${projectId}, totalAssigned: ${totalAssigned}, totalEarned: ${earnings.totalEarned}`,
    );

    return plainToInstance(
      ConsultantOverviewResponseDto,
      {
        project: {
          id: project.id,
          title: project.title,
          payment_type: project.paymentType,
          status: project.status,
          started_at: project.startedAt,
          days_remaining: null,
        },
        consultant: {
          id: consultantProfile.id,
          full_name: consultantProfile.fullName,
          avatar_url: consultantProfile.avatarUrl ?? null,
          joined_at: member.joinedAt,
        },
        progress: {
          by_status: this.compactByStatus(byStatus),
          total_assigned: totalAssigned,
          completion_rate: completionRate,
        },
        earnings: earningsBlock,
        ...(nextPayment ? { next_payment: nextPayment } : {}),
      },
      { excludeExtraneousValues: true },
    );
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private sumByStatus(byStatus: Record<TaskKanbanStatus, number>): number {
    let total = 0;
    for (const status of Object.values(TaskKanbanStatus)) {
      // DRAFT is excluded by the repository query, but defend against future drift.
      if (status === TaskKanbanStatus.DRAFT) continue;
      total += byStatus[status as TaskKanbanStatus] ?? 0;
    }
    return total;
  }

  // Strip zero-count statuses so the response payload only carries what the
  // consultant actually has — keeps the by_status block readable.
  private compactByStatus(byStatus: Record<TaskKanbanStatus, number>): IConsultantOverviewByStatus {
    const out: IConsultantOverviewByStatus = {};
    for (const [status, count] of Object.entries(byStatus)) {
      if (count > 0) out[status as TaskKanbanStatus] = count;
    }
    return out;
  }

  private toCompletedTasks(
    rows: Array<{
      id: string;
      task_id: string | null;
      task_code: string | null;
      task_title: string | null;
      amount: number;
    }>,
  ): IConsultantOverviewCompletedTask[] {
    return rows.map((r) => ({
      id: r.id,
      task_id: r.task_id,
      task_code: r.task_code,
      task_name: r.task_title,
      amount: r.amount,
    }));
  }

  // 5th of next month at 00:00 UTC. Returns the same calendar day in `now`'s
  // local-timezone-agnostic Date arithmetic — adequate for "days_until"
  // display, exact wall-clock cadence is owned by BillingSettlementService.
  private computeNextPayment(
    lastPaidAt: Date | null,
    lastAmount: number,
  ): IConsultantOverviewNextPayment {
    const now = DateUtil.nowDate();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const dayOfMonth = now.getUTCDate();
    // If we're past the 5th already, target next month.
    const targetMonthOffset = dayOfMonth >= PER_MONTH_PAYOUT_DAY ? 1 : 0;
    const date = new Date(Date.UTC(year, month + targetMonthOffset, PER_MONTH_PAYOUT_DAY));
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysUntil = Math.max(0, Math.ceil((date.getTime() - now.getTime()) / msPerDay));

    return {
      date,
      days_until: daysUntil,
      amount: lastAmount,
      currency: DEFAULT_CURRENCY,
      last_paid_at: lastPaidAt,
    };
  }
}
