import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import {
  ConsultantTransactionType,
  Currency,
  OnboardingDecision,
  ProficiencyLevel,
  TaskKanbanStatus,
  TransactionStatus,
} from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { ConsultantDashboardSummaryResponseDto } from '../../../dto/responses/consultant-dashboard-summary-response.dto';
import {
  CONSULTANT_DASHBOARD_CACHE_KEYS,
  CONSULTANT_DASHBOARD_CACHE_TTL_SECONDS,
} from '../constants';
import { IConsultantDashboardSummaryService } from '../interfaces/consultant-dashboard-summary-service.interface';

@Injectable()
export class ConsultantDashboardSummaryService implements IConsultantDashboardSummaryService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantDashboardSummaryService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(): Promise<ConsultantDashboardSummaryResponseDto> {
    const userId = this.requestContext.userId!;
    this.logger.log(`get — start | userId: ${userId}`);

    const consultantProfile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!consultantProfile) {
      this.logger.warn(`get — consultant profile not found | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    const consultantId = consultantProfile.id;

    const cacheKey = CONSULTANT_DASHBOARD_CACHE_KEYS.summary(consultantId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`get — cache hit | consultantId: ${consultantId}`);
      return plainToInstance(
        ConsultantDashboardSummaryResponseDto,
        JSON.parse(cached) as Record<string, unknown>,
        { excludeExtraneousValues: true },
      );
    }

    const now = new Date();
    const mtdStart = DateUtil.toDate(DateUtil.startOf(now, 'month'));

    // Active project ids are the universe for downstream task aggregates that
    // we don't have here (the assignee-keyed aggregates already restrict by
    // assigned_to). Still useful for the `active_projects` count.
    const activeProjectIds =
      await this.uow.projectMembers.findActiveProjectIdsByConsultantOnly(consultantId);

    const [
      tasksByStatus,
      tasksCompletedMtd,
      tasksOverdue,
      avgCycleDays,
      onTime,
      revisionsRequested,
      pendingCredits,
      clearedCreditsMtd,
      totalWithdrawnMtd,
      lifetimeEarnings,
      proficiencyCounts,
      activeExam,
      totalPassedSkills,
      onboarding,
      pendingWithdrawalsCount,
      unreadNotifications,
    ] = await Promise.all([
      this.uow.tasks.countByAssigneeGroupedByStatus(consultantId),
      this.uow.tasks.countCompletedByAssigneeBetween(consultantId, mtdStart, now),
      this.uow.tasks.countOverdueByAssignee(consultantId),
      this.uow.tasks.avgCycleDaysByAssigneeBetween(consultantId, mtdStart, now),
      this.uow.tasks.countOnTimeByAssigneeBetween(consultantId, mtdStart, now),
      this.uow.tasks.countRevisionRequestedByAssignee(consultantId),
      this.uow.consultantTransactions.sumPendingCreditsByConsultantId(consultantId),
      this.uow.consultantTransactions.sumAmountByConsultantTypesStatusBetween(
        consultantId,
        [ConsultantTransactionType.CREDIT_CLEARED],
        TransactionStatus.COMPLETED,
        mtdStart,
        now,
      ),
      this.uow.consultantTransactions.sumAmountByConsultantTypesStatusBetween(
        consultantId,
        [ConsultantTransactionType.WITHDRAWAL],
        TransactionStatus.COMPLETED,
        mtdStart,
        now,
      ),
      this.uow.consultantTransactions.sumAmountByConsultantAndTypes(consultantId, [
        ConsultantTransactionType.CREDIT_CLEARED,
      ]),
      this.uow.consultantSkills.countByConsultantGroupedByProficiency(consultantId),
      this.uow.consultantSkillExams.findActiveByConsultantIdWithSkill(consultantId),
      this.uow.consultantSkillExams.countPassedByConsultantId(consultantId),
      this.uow.consultantOnboardings.findByUserId(userId),
      this.uow.consultantTransactions.countPendingWithdrawalsByConsultantId(consultantId),
      this.uow.notifications.countUnreadByUserId(userId),
    ]);

    const onTimePct = onTime.total > 0 ? ((onTime.onTime / onTime.total) * 100).toFixed(1) : null;
    const avgCycleStr = avgCycleDays !== null ? avgCycleDays.toFixed(1) : null;
    const inProgress = tasksByStatus[TaskKanbanStatus.IN_PROGRESS];
    const inReview = tasksByStatus[TaskKanbanStatus.IN_REVIEW];
    const pendingApproval = tasksByStatus[TaskKanbanStatus.PENDING_APPROVAL];
    const verifiedSkills =
      proficiencyCounts[ProficiencyLevel.INTERMEDIATE] +
      proficiencyCounts[ProficiencyLevel.SENIOR] +
      proficiencyCounts[ProficiencyLevel.EXPERT];

    const payload = {
      money: {
        currency: Currency.USD,
        wallet_balance: consultantProfile.accountBalance,
        pending_credits: pendingCredits,
        cleared_credits_mtd: clearedCreditsMtd,
        total_withdrawn_mtd: totalWithdrawnMtd,
        lifetime_earnings: lifetimeEarnings,
      },
      portfolio: {
        active_projects: activeProjectIds.length,
        total_tasks_in_progress: inProgress,
        total_tasks_in_review: inReview,
        tasks_completed_mtd: tasksCompletedMtd,
        tasks_overdue: tasksOverdue,
      },
      performance: {
        on_time_pct: onTimePct,
        avg_cycle_days: avgCycleStr,
        avg_rating: consultantProfile.avgRating,
        revisions_requested_count: revisionsRequested,
      },
      skills: {
        verified_skills_count: verifiedSkills,
        expert_count: proficiencyCounts[ProficiencyLevel.EXPERT],
        senior_count: proficiencyCounts[ProficiencyLevel.SENIOR],
        intermediate_count: proficiencyCounts[ProficiencyLevel.INTERMEDIATE],
      },
      exams: {
        active_exam_id: activeExam?.id ?? null,
        active_skill_name: activeExam?.skill?.name ?? null,
        active_status: activeExam?.status ?? null,
        expires_at: activeExam?.expiresAt ? activeExam.expiresAt.toISOString() : null,
        total_passed_skills: totalPassedSkills,
      },
      onboarding: {
        status: onboarding?.status ?? null,
        decision: onboarding?.decision ?? null,
        blocked_until: onboarding?.blockedUntil ? onboarding.blockedUntil.toISOString() : null,
        is_approved: onboarding?.decision === OnboardingDecision.APPROVED,
      },
      action_counts: {
        revision_requested_tasks: revisionsRequested,
        overdue_tasks: tasksOverdue,
        pending_approval_tasks: inReview + pendingApproval,
        unread_notifications: unreadNotifications,
        pending_withdrawals: pendingWithdrawalsCount,
      },
      generated_at: now.toISOString(),
    };

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(payload),
        CONSULTANT_DASHBOARD_CACHE_TTL_SECONDS.summary,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `get — cache set failed | error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(
      `get — complete | consultantId: ${consultantId}, active_projects: ${activeProjectIds.length}, lifetime: ${lifetimeEarnings}, in_progress: ${inProgress}`,
    );

    return plainToInstance(ConsultantDashboardSummaryResponseDto, payload, {
      excludeExtraneousValues: true,
    });
  }
}
