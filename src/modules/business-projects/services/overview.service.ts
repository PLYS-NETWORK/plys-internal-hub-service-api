import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { Money } from '@common/utils/money';
import {
  ApplicationStatus,
  ProjectMemberActiveStatus,
  ProjectMemberStatus,
  TaskKanbanStatus,
} from '@database/enums';
import { ActivityType, IActivityEventRow } from '@modules/unit-of-work/repositories';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import {
  IOverviewActivityEvent,
  IOverviewApplicationBreakdown,
  IOverviewStatistics,
  IOverviewSummary,
  IOverviewTaskStatuses,
  IOverviewTeamMember,
} from '../dto/responses/interfaces/overview.response.interface';
import { OverviewResponseDto } from '../dto/responses/overview-response.dto';
import { IBusinessProjectOverviewService } from '../interfaces/overview.service.interface';
import { BusinessAccessService } from './business-access.service';

const ACTIVE_THRESHOLD_HOURS = 8;
const IDLE_THRESHOLD_HOURS = 48;
const RECENT_ACTIVITY_LIMIT = 20;

interface ITeamMemberRow {
  consultant_id: string;
  full_name: string;
  avatar_url: string | null;
  last_login_at: Date | null;
}

@Injectable()
export class BusinessProjectOverviewService implements IBusinessProjectOverviewService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
    private readonly access: BusinessAccessService,
  ) {
    this.logger = new AppLogger(BusinessProjectOverviewService.name, requestContext);
  }

  /** @inheritdoc */
  public async getOverview(projectId: string): Promise<OverviewResponseDto> {
    this.logger.log(`getOverview — start | projectId: ${projectId}`);

    const { project, businessProfile } = await this.access.resolveOwnedProject(projectId);

    // Run the six independent queries in parallel — each maps to one section
    // of the response. All six are scoped to a single projectId so there's no
    // cross-tenant risk; ownership has already been asserted above.
    const [
      taskStatuses,
      applicationCounts,
      pendingApplicationsCount,
      teamMembers,
      activityRows,
      projectCost,
    ] = await Promise.all([
      this.fetchTaskStatuses(projectId),
      this.fetchApplicationCounts(projectId),
      this.uow.projectApplications.countByProjectIdAndStatus(projectId, ApplicationStatus.PENDING),
      this.fetchTeamMembers(projectId),
      this.uow.projectActivity.findEventsByProjectId(
        projectId,
        0,
        RECENT_ACTIVITY_LIMIT,
        undefined as ActivityType[] | undefined,
      ),
      this.fetchProjectCost(projectId),
    ]);

    const summary: IOverviewSummary = {
      title: project.title,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
      published_at: project.publishedAt,
      business_company_name: businessProfile.companyName,
      status: project.status,
      payment_type: project.paymentType,
      project_cost: projectCost.toFixedString(),
    };

    const totalApplications =
      applicationCounts.pending +
      applicationCounts.accepted +
      applicationCounts.rejected +
      applicationCounts.withdrawn;

    const statistics: IOverviewStatistics = {
      // total_tasks excludes drafts (drafts are not "on the board" yet).
      total_tasks: this.sumNonDraft(taskStatuses),
      completed_tasks: taskStatuses[TaskKanbanStatus.DONE],
      in_progress_tasks: taskStatuses[TaskKanbanStatus.IN_PROGRESS],
      total_project_members: teamMembers.length,
      total_pending_applications: pendingApplicationsCount,
      total_applications: totalApplications,
      total_approved: applicationCounts.accepted,
      total_rejected: applicationCounts.rejected,
    };

    const taskStatusesDto: IOverviewTaskStatuses = {
      draft: taskStatuses[TaskKanbanStatus.DRAFT],
      to_do: taskStatuses[TaskKanbanStatus.TO_DO],
      assigned: taskStatuses[TaskKanbanStatus.ASSIGNED],
      in_progress: taskStatuses[TaskKanbanStatus.IN_PROGRESS],
      in_review: taskStatuses[TaskKanbanStatus.IN_REVIEW],
      pending_approval: taskStatuses[TaskKanbanStatus.PENDING_APPROVAL],
      revision_requested: taskStatuses[TaskKanbanStatus.REVISION_REQUESTED],
      done: taskStatuses[TaskKanbanStatus.DONE],
      cancelled: taskStatuses[TaskKanbanStatus.CANCELLED],
    };

    const tz = this.requestContext.timezone ?? undefined;
    const now = DateUtil.now(tz).toDate();
    const teamMemberDtos: IOverviewTeamMember[] = teamMembers.map((m) => ({
      consultant_id: m.consultant_id,
      full_name: m.full_name,
      avatar_url: m.avatar_url,
      active_status: bucketActiveStatus(m.last_login_at, now),
    }));

    const reviewedTotal = applicationCounts.accepted + applicationCounts.rejected;
    const applicationBreakdown: IOverviewApplicationBreakdown = {
      pending: applicationCounts.pending,
      accepted: applicationCounts.accepted,
      rejected: applicationCounts.rejected,
      withdrawn: applicationCounts.withdrawn,
      approval_rate:
        reviewedTotal === 0 ? null : Math.round((applicationCounts.accepted / reviewedTotal) * 100),
    };

    const [rows] = activityRows;
    const recentActivity: IOverviewActivityEvent[] = rows.map((row) => this.toActivityEvent(row));

    this.logger.log(
      `getOverview — complete | projectId: ${projectId}, members: ${teamMemberDtos.length}, events: ${recentActivity.length}`,
    );

    return plainToInstance(
      OverviewResponseDto,
      {
        summary,
        statistics,
        task_statuses: taskStatusesDto,
        team_members: teamMemberDtos,
        application_breakdown: applicationBreakdown,
        recent_activity: recentActivity,
      },
      { excludeExtraneousValues: true },
    );
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async fetchTaskStatuses(projectId: string): Promise<Record<TaskKanbanStatus, number>> {
    return this.uow.tasks.countByProjectIdsGroupedByStatus([projectId], projectId);
  }

  private sumNonDraft(byStatus: Record<TaskKanbanStatus, number>): number {
    let total = 0;
    for (const status of Object.keys(byStatus) as TaskKanbanStatus[]) {
      if (status === TaskKanbanStatus.DRAFT) continue;
      total += byStatus[status];
    }
    return total;
  }

  private async fetchApplicationCounts(projectId: string): Promise<{
    pending: number;
    accepted: number;
    rejected: number;
    withdrawn: number;
  }> {
    const rows = await this.uow.projectApplications.countByProjectIdsGroupedByProjectAndStatus(
      [projectId],
      projectId,
    );
    const row = rows[0];
    return {
      pending: row?.pending_count ?? 0,
      accepted: row?.approved_count ?? 0,
      rejected: row?.rejected_count ?? 0,
      withdrawn: row?.withdrawn_count ?? 0,
    };
  }

  // Active members of a project with the consultant profile and their last
  // login time. Hand-rolled because the existing repo helper does not include
  // the avatar URL — and the team-members card needs it.
  private async fetchTeamMembers(projectId: string): Promise<ITeamMemberRow[]> {
    return this.uow.projectMembers
      .createQueryBuilder('pm')
      .innerJoin('pm.consultant', 'cp')
      .innerJoin('cp.user', 'u')
      .select('cp.id', 'consultant_id')
      .addSelect('cp.full_name', 'full_name')
      .addSelect('cp.avatar_url', 'avatar_url')
      .addSelect('u.last_login_at', 'last_login_at')
      .where('pm.project_id = :projectId', { projectId })
      .andWhere('pm.status = :active', { active: ProjectMemberStatus.ACTIVE })
      .orderBy('pm.joined_at', 'ASC')
      .getRawMany<ITeamMemberRow>();
  }

  private async fetchProjectCost(projectId: string): Promise<Money> {
    const row = await this.uow.tasks
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.price), 0)', 'sum')
      .where('t.project_id = :projectId', { projectId })
      .andWhere('t.kanban_status != :cancelled', { cancelled: TaskKanbanStatus.CANCELLED })
      .andWhere('t.deleted_at IS NULL')
      .getRawOne<{ sum: string }>();
    return Money.from(row?.sum ?? '0');
  }

  private toActivityEvent(row: IActivityEventRow): IOverviewActivityEvent {
    return {
      event_type: row.event_type as IOverviewActivityEvent['event_type'],
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
