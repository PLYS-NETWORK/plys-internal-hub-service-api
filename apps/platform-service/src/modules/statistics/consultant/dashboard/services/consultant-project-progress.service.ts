import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { Project } from '@plys/libraries/database/entities';
import { ProjectStatus, TaskKanbanStatus } from '@plys/libraries/database/enums';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ConsultantProjectProgressDto } from '../../../dto/requests/consultant-project-progress.dto';
import { ConsultantProjectProgressResponseDto } from '../../../dto/responses/consultant-project-progress-response.dto';
import { IConsultantProjectProgressService } from '../interfaces/consultant-project-progress-service.interface';

interface IProjectAggregate {
  assigned: number;
  in_progress: number;
  in_review: number;
  pending_approval: number;
  completed: number;
  overdue: number;
  revision_requested: number;
}

interface IProgressItem {
  project_id: string;
  code: string;
  title: string;
  status: ProjectStatus;
  payment_type: Project['paymentType'];
  joined_at: string;
  my_assigned_tasks: number;
  my_in_progress_tasks: number;
  my_in_review_tasks: number;
  my_completed_tasks: number;
  my_overdue_tasks: number;
  my_revision_requested_tasks: number;
  my_completion_pct: string | null;
  my_earnings_in_project: string;
  last_activity_at: string | null;
  is_at_risk: boolean;
}

@Injectable()
export class ConsultantProjectProgressService implements IConsultantProjectProgressService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantProjectProgressService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(
    dto: ConsultantProjectProgressDto,
  ): Promise<ConsultantProjectProgressResponseDto> {
    const userId = this.requestContext.userId!;
    const consultantProfile = await this.uow.consultantProfiles.findByUserId(userId);
    if (!consultantProfile) {
      throw new TranslatableException({
        messageKey: 'error.consultant_profile.not_found',
        errorCode: ERROR_CODES.CONSULTANT_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    const consultantId = consultantProfile.id;
    const now = new Date();

    this.logger.log(
      `get — start | consultantId: ${consultantId}, status: ${dto.status ?? '-'}, limit: ${dto.limit}`,
    );

    const memberships = await this.uow.projectMembers.findActiveByConsultantIdLightweight(
      consultantId,
      dto.status,
      dto.limit,
    );
    if (memberships.length === 0) {
      this.logger.log(`get — complete | consultantId: ${consultantId}, projects: 0`);
      return plainToInstance(
        ConsultantProjectProgressResponseDto,
        { projects: [], generated_at: now.toISOString() },
        { excludeExtraneousValues: true },
      );
    }

    const projectIds = memberships.map((m) => m.project.id);

    const [taskBreakdown, lastActivityByProject, earningsByProject] = await Promise.all([
      this.uow.tasks.countByAssigneeAndProjectIdsBreakdown(consultantId, projectIds),
      this.uow.tasks.findLatestActivityByAssigneeAndProjectIds(consultantId, projectIds),
      this.uow.consultantTransactions.sumClearedEarningsByConsultantGroupedByProject(
        consultantId,
        projectIds,
      ),
    ]);

    const aggregateByProject = new Map<string, IProjectAggregate>();
    for (const row of taskBreakdown) {
      const agg = aggregateByProject.get(row.project_id) ?? {
        assigned: 0,
        in_progress: 0,
        in_review: 0,
        pending_approval: 0,
        completed: 0,
        overdue: 0,
        revision_requested: 0,
      };
      switch (row.kanban_status as TaskKanbanStatus) {
        case TaskKanbanStatus.ASSIGNED:
          agg.assigned += row.count;
          break;
        case TaskKanbanStatus.IN_PROGRESS:
          agg.in_progress += row.count;
          break;
        case TaskKanbanStatus.IN_REVIEW:
          agg.in_review += row.count;
          break;
        case TaskKanbanStatus.PENDING_APPROVAL:
          agg.pending_approval += row.count;
          break;
        case TaskKanbanStatus.DONE:
          agg.completed += row.count;
          break;
        case TaskKanbanStatus.REVISION_REQUESTED:
          agg.revision_requested += row.count;
          break;
        default:
          break;
      }
      agg.overdue += row.overdue_count;
      aggregateByProject.set(row.project_id, agg);
    }

    const items: IProgressItem[] = memberships.map((membership) => {
      const project = membership.project;
      const agg = aggregateByProject.get(project.id);
      const assigned =
        (agg?.assigned ?? 0) +
        (agg?.in_progress ?? 0) +
        (agg?.in_review ?? 0) +
        (agg?.pending_approval ?? 0) +
        (agg?.revision_requested ?? 0);
      const completed = agg?.completed ?? 0;
      const denominator = assigned + completed;
      const completionPct = denominator > 0 ? ((completed / denominator) * 100).toFixed(1) : null;
      const overdue = agg?.overdue ?? 0;
      const revisionRequested = agg?.revision_requested ?? 0;
      const lastActivity = lastActivityByProject.get(project.id) ?? null;
      return {
        project_id: project.id,
        code: project.code,
        title: project.title,
        status: project.status,
        payment_type: project.paymentType,
        joined_at: membership.joinedAt.toISOString(),
        my_assigned_tasks: assigned,
        my_in_progress_tasks: agg?.in_progress ?? 0,
        my_in_review_tasks: (agg?.in_review ?? 0) + (agg?.pending_approval ?? 0),
        my_completed_tasks: completed,
        my_overdue_tasks: overdue,
        my_revision_requested_tasks: revisionRequested,
        my_completion_pct: completionPct,
        my_earnings_in_project: earningsByProject.get(project.id) ?? '0.00',
        last_activity_at: lastActivity ? lastActivity.toISOString() : null,
        is_at_risk: overdue > 0 || revisionRequested > 0,
      };
    });

    // At-risk first; within each tier, most-recently-active first.
    items.sort((a, b) => {
      if (a.is_at_risk !== b.is_at_risk) return a.is_at_risk ? -1 : 1;
      const aTime = a.last_activity_at ? Date.parse(a.last_activity_at) : 0;
      const bTime = b.last_activity_at ? Date.parse(b.last_activity_at) : 0;
      return bTime - aTime;
    });

    this.logger.log(
      `get — complete | consultantId: ${consultantId}, projects: ${items.length}, at_risk: ${items.filter((i) => i.is_at_risk).length}`,
    );

    return plainToInstance(
      ConsultantProjectProgressResponseDto,
      { projects: items, generated_at: now.toISOString() },
      { excludeExtraneousValues: true },
    );
  }
}
