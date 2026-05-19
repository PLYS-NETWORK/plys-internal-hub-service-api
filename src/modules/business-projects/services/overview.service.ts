import { UrlResolverService } from '@common/modules/file-storage';
import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { Money } from '@common/utils/money';
import {
  BusinessTransactionType,
  Currency,
  ProficiencyLevel,
  ProjectMemberActiveStatus,
  ProjectMemberStatus,
  ProjectPaymentType,
  TaskKanbanStatus,
} from '@database/enums';
import {
  ActivityType,
  IActivityEventRow,
  IConsultantSkillRow,
} from '@modules/unit-of-work/repositories';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  PROJECT_OVERVIEW_ACTION_ITEMS_LIMIT,
  PROJECT_OVERVIEW_ACTIVITY_LIMIT,
  PROJECT_OVERVIEW_CACHE_KEY,
  PROJECT_OVERVIEW_CACHE_TTL_SECONDS,
  PROJECT_OVERVIEW_STALE_REVIEW_DAYS,
  PROJECT_OVERVIEW_TEAM_LIMIT,
} from '../constants';
import { OverviewResponseDto } from '../dto/responses/overview-response.dto';
import { IBusinessProjectOverviewService } from '../interfaces/overview.service.interface';
import { BusinessAccessService } from './business-access.service';

const ACTIVE_THRESHOLD_HOURS = 8;
const IDLE_THRESHOLD_HOURS = 48;
const STALE_REVIEW_MS = PROJECT_OVERVIEW_STALE_REVIEW_DAYS * 24 * 60 * 60 * 1000;

interface ITeamMemberContext {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
  last_login_at: Date | null;
  joined_at: Date;
}

@Injectable()
export class BusinessProjectOverviewService implements IBusinessProjectOverviewService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly redis: RedisService,
    requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
    private readonly urlResolver: UrlResolverService,
  ) {
    this.logger = new AppLogger(BusinessProjectOverviewService.name, requestContext);
  }

  /** @inheritdoc */
  public async getOverview(projectId: string): Promise<OverviewResponseDto> {
    this.logger.log(`getOverview — start | projectId: ${projectId}`);

    const { project, businessProfile } = await this.access.resolveOwnedProject(projectId);

    const cacheKey = PROJECT_OVERVIEW_CACHE_KEY(projectId);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.log(`getOverview — cache hit | projectId: ${projectId}`);
      const parsed = JSON.parse(cached) as Record<string, unknown>;
      // The cached payload holds the raw storage URLs (so the cache survives
      // the 15-min S3 presign TTL); re-sign on the response boundary.
      await this.resignTeamAvatars(parsed);
      return plainToInstance(OverviewResponseDto, parsed, {
        excludeExtraneousValues: true,
      });
    }

    const now = new Date();
    const mtdStart = DateUtil.toDate(DateUtil.startOf(now, 'month'));
    const sevenDaysAgo = DateUtil.toDate(DateUtil.subtract(now, 7, 'day'));

    // Roster + project required-skill-ids need to land first so the
    // per-consultant performance + skill rows can reference them. Everything
    // else fires in the main fan-out below.
    const [memberRows, requiredSkillIds] = await Promise.all([
      this.fetchTeamMemberRows(projectId),
      this.uow.projectRequiredSkills.findSkillIdsByProjectId(projectId),
    ]);
    const consultantIds = memberRows.map((m) => m.consultant_id);

    const projectedBillCall =
      project.paymentType === ProjectPaymentType.PER_MONTH
        ? this.uow.businessTransactions.sumProjectedMonthlyBillByProjectId(projectId)
        : Promise.resolve(null);

    const [
      healthRows,
      statusCounts,
      completedLast7d,
      outflowByType,
      draftPipeline,
      projectedBill,
      perfRows,
      consultantSkills,
      awaitingReviewRows,
      overdueRows,
      overdueCount,
      disputeRows,
      disputeCount,
      activityResult,
    ] = await Promise.all([
      this.uow.tasks.aggregateHealthByProjectIds([projectId]),
      this.uow.tasks.countByProjectIdsGroupedByStatus([projectId], projectId),
      this.uow.tasks.countCompletedByProjectIdsBetween([projectId], sevenDaysAgo, now),
      this.uow.businessTransactions.sumOutflowByProjectIdGroupedByType(projectId),
      this.uow.tasks.sumDraftPricesByProjectId(projectId),
      projectedBillCall,
      this.uow.tasks.aggregatePerformanceByAssigneesBetween(
        [projectId],
        consultantIds,
        mtdStart,
        now,
      ),
      this.uow.consultantSkills.findByConsultantIds(consultantIds),
      this.uow.tasks.findAwaitingReviewByProjectIds(
        [projectId],
        PROJECT_OVERVIEW_ACTION_ITEMS_LIMIT,
      ),
      this.uow.tasks.findOverdueByProjectIds([projectId], PROJECT_OVERVIEW_ACTION_ITEMS_LIMIT),
      this.uow.tasks.countOverdueByProjectIds([projectId]),
      this.uow.taskDisputes.findOpenByProjectId(projectId, PROJECT_OVERVIEW_ACTION_ITEMS_LIMIT),
      this.uow.taskDisputes.countOpenByProjectId(projectId),
      this.uow.projectActivity.findEventsByProjectId(
        projectId,
        0,
        PROJECT_OVERVIEW_ACTIVITY_LIMIT,
        undefined as ActivityType[] | undefined,
      ),
    ]);

    const [activityRows] = activityResult;
    const health = healthRows[0];

    const summary = {
      id: project.id,
      code: project.code,
      title: project.title,
      status: project.status,
      payment_type: project.paymentType,
      business_company_name: businessProfile.companyName,
      required_consultants: project.requiredConsultants,
      created_at: project.createdAt.toISOString(),
      published_at: project.publishedAt ? project.publishedAt.toISOString() : null,
      started_at: project.startedAt ? project.startedAt.toISOString() : null,
      completed_at: project.completedAt ? project.completedAt.toISOString() : null,
    };

    const total = health?.total ?? 0;
    const completed = health?.completed ?? 0;
    const inReview = health?.in_review ?? 0;
    const overdue = health?.overdue ?? 0;
    const lastActivity = health?.last_activity_at ?? null;
    const oldestInReview = health?.oldest_in_review_at ?? null;
    const reviewStale =
      oldestInReview !== null && Date.now() - oldestInReview.getTime() > STALE_REVIEW_MS;

    const healthBlock = {
      total_tasks: total,
      completed_tasks: completed,
      in_review_tasks: inReview,
      in_progress_tasks: statusCounts[TaskKanbanStatus.IN_PROGRESS] ?? 0,
      overdue_tasks: overdue,
      completion_pct: total > 0 ? ((completed / total) * 100).toFixed(1) : null,
      tasks_completed_last_7d: completedLast7d,
      open_disputes: disputeCount,
      is_at_risk: overdue > 0 || (inReview > 0 && reviewStale),
      last_activity_at: lastActivity ? lastActivity.toISOString() : null,
    };

    const spentOnPublish = outflowByType.get(BusinessTransactionType.PROJECT_PUBLISHED) ?? '0.00';
    const spentOnTasks = outflowByType.get(BusinessTransactionType.TASK_ADDED) ?? '0.00';
    const totalSpent = (Number(spentOnPublish) + Number(spentOnTasks)).toFixed(2);
    const money = {
      currency: Currency.USD,
      spent_on_publish: Money.from(spentOnPublish).toFixedString(),
      spent_on_tasks: Money.from(spentOnTasks).toFixedString(),
      total_spent: Money.from(totalSpent).toFixedString(),
      unpublished_pipeline_value: Money.from(draftPipeline).toFixedString(),
      projected_monthly_bill:
        projectedBill !== null ? Money.from(projectedBill).toFixedString() : null,
    };

    const requiredSkillSet = new Set(requiredSkillIds);
    const skillsByConsultant = new Map<string, IConsultantSkillRow[]>();
    for (const row of consultantSkills) {
      const list = skillsByConsultant.get(row.consultant_id) ?? [];
      list.push(row);
      skillsByConsultant.set(row.consultant_id, list);
    }
    const perfByConsultant = new Map(perfRows.map((r) => [r.consultant_id, r]));

    const team = memberRows.map((m) => {
      const perf = perfByConsultant.get(m.consultant_id);
      const totalDone = perf?.total_done ?? 0;
      const skills = (skillsByConsultant.get(m.consultant_id) ?? []).map((s) => ({
        skill_id: s.skill_id,
        skill_name: s.skill_name,
        proficiency_level: s.proficiency_level as ProficiencyLevel | null,
        rating: s.rating,
        is_required: requiredSkillSet.has(s.skill_id),
      }));
      // Stored URL is preserved verbatim here; `resignTeamAvatars` runs at the
      // response boundary so the cached payload outlives the 15-min S3 TTL.
      return {
        consultant_id: m.consultant_id,
        full_name: m.full_name,
        avatar_url: m.avatar_url,
        active_status: bucketActiveStatus(m.last_login_at, now),
        joined_at: m.joined_at.toISOString(),
        completed_tasks: perf?.completed ?? 0,
        in_progress_tasks: perf?.in_progress ?? 0,
        avg_cycle_days:
          perf?.avg_cycle_days !== undefined && perf?.avg_cycle_days !== null
            ? perf.avg_cycle_days.toFixed(1)
            : null,
        on_time_pct: totalDone > 0 ? (((perf?.on_time ?? 0) / totalDone) * 100).toFixed(1) : null,
        skills,
      };
    });

    const actionItems = {
      tasks_awaiting_review: {
        total: inReview,
        items: awaitingReviewRows.map((r) => ({
          task_id: r.task_id,
          task_code: r.task_code,
          title: r.title,
          reference_at: r.reference_at.toISOString(),
          days_overdue: null,
        })),
      },
      overdue_tasks: {
        total: overdueCount,
        items: overdueRows.map((r) => ({
          task_id: r.task_id,
          task_code: r.task_code,
          title: r.title,
          reference_at: r.reference_at.toISOString(),
          days_overdue: r.days_overdue ?? 0,
        })),
      },
      open_disputes: {
        total: disputeCount,
        items: disputeRows.map((r) => ({
          dispute_id: r.dispute_id,
          task_id: r.task_id,
          task_code: r.task_code,
          reason_snippet: r.reason_snippet,
          opened_at: r.opened_at.toISOString(),
        })),
      },
    };

    const activity = activityRows.map((row) => this.toActivityEvent(row));

    const payload = {
      summary,
      health: healthBlock,
      money,
      team,
      action_items: actionItems,
      activity,
      generated_at: now.toISOString(),
    };

    try {
      // Cache the raw-URL payload — the response boundary re-signs avatars so
      // a cached row stays valid past the 15-min S3 presign TTL.
      await this.redis.set(cacheKey, JSON.stringify(payload), PROJECT_OVERVIEW_CACHE_TTL_SECONDS);
    } catch (err: unknown) {
      this.logger.warn(
        `getOverview — cache set failed | error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.logger.log(
      `getOverview — complete | projectId: ${projectId}, members: ${team.length}, events: ${activity.length}, total_spent: ${money.total_spent}`,
    );

    await this.resignTeamAvatars(payload);
    return plainToInstance(OverviewResponseDto, payload, { excludeExtraneousValues: true });
  }

  /**
   * Mutates the `team[].avatar_url` array on a payload object so every value
   * is freshly presigned. Runs at the response boundary on both the cache-hit
   * and cache-miss paths — never on the cached value itself.
   */
  private async resignTeamAvatars(payload: Record<string, unknown>): Promise<void> {
    const team = payload['team'];
    if (!Array.isArray(team) || team.length === 0) return;
    const resigned = await this.urlResolver.resolveMany(
      team.map((m: { avatar_url?: string | null }) => m.avatar_url),
    );
    team.forEach((m: { avatar_url?: string | null }, idx) => {
      m.avatar_url = resigned[idx];
    });
  }

  // Active members joined to the consultant profile + user. Hand-rolled
  // because the existing roster helper doesn't include `last_login_at`,
  // which the active-status bucketing depends on. Capped at
  // PROJECT_OVERVIEW_TEAM_LIMIT.
  private async fetchTeamMemberRows(projectId: string): Promise<ITeamMemberContext[]> {
    return this.uow.projectMembers
      .createQueryBuilder('pm')
      .innerJoin('pm.consultant', 'cp')
      .innerJoin('cp.user', 'u')
      .select('cp.id', 'consultant_id')
      .addSelect('cp.full_name', 'full_name')
      .addSelect('cp.avatar_url', 'avatar_url')
      .addSelect('u.last_login_at', 'last_login_at')
      .addSelect('pm.joined_at', 'joined_at')
      .where('pm.project_id = :projectId', { projectId })
      .andWhere('pm.status = :active', { active: ProjectMemberStatus.ACTIVE })
      .orderBy('pm.joined_at', 'ASC')
      .limit(PROJECT_OVERVIEW_TEAM_LIMIT)
      .getRawMany<ITeamMemberContext>();
  }

  private toActivityEvent(row: IActivityEventRow): {
    event_type: IActivityEventRow['event_type'];
    event_id: string;
    occurred_at: Date;
    actor: { user_id: string | null; name: string | null };
    payload: Record<string, unknown>;
  } {
    return {
      event_type: row.event_type,
      event_id: row.event_id,
      occurred_at: row.occurred_at,
      actor: { user_id: row.actor_user_id, name: row.actor_name },
      payload: row.payload,
    };
  }
}

function bucketActiveStatus(lastActiveAt: Date | null, now: Date): ProjectMemberActiveStatus {
  if (!lastActiveAt) return ProjectMemberActiveStatus.INACTIVE;
  const hoursAgo = DateUtil.diff(now, lastActiveAt, 'hour', true);
  if (hoursAgo < ACTIVE_THRESHOLD_HOURS) return ProjectMemberActiveStatus.ACTIVE;
  if (hoursAgo < IDLE_THRESHOLD_HOURS) return ProjectMemberActiveStatus.IDLE;
  return ProjectMemberActiveStatus.INACTIVE;
}
