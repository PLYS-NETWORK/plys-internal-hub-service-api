import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { DateUtil } from '@common/utils/date';
import { Project } from '@database/entities';
import { ProjectStatus } from '@database/enums';
import { IProjectHealthAggregate } from '@modules/unit-of-work/repositories/tasks/interfaces';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { BusinessProjectHealthDto } from '../../../dto/requests/business-project-health.dto';
import { BusinessProjectHealthResponseDto } from '../../../dto/responses/business-project-health-response.dto';
import { IBusinessProjectHealthService } from '../interfaces/business-project-health-service.interface';

// "Stale" review window — if a task has been sitting in IN_REVIEW longer than
// this, the project gets flagged at-risk even when no task is overdue. Tuned
// to a week so it's noticeable without being noisy.
const STALE_REVIEW_DAYS = 7;
const STALE_REVIEW_MS = STALE_REVIEW_DAYS * 24 * 60 * 60 * 1000;

@Injectable()
export class BusinessProjectHealthService implements IBusinessProjectHealthService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(BusinessProjectHealthService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(dto: BusinessProjectHealthDto): Promise<BusinessProjectHealthResponseDto> {
    const userId = this.requestContext.userId!;
    const businessProfile = await this.uow.businessProfiles.findByUserId(userId);
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }
    const businessId = businessProfile.id;

    this.logger.log(
      `get — start | businessId: ${businessId}, status: ${dto.status ?? '-'}, limit: ${dto.limit}`,
    );

    const statuses = dto.status
      ? [dto.status]
      : [ProjectStatus.PUBLISHED, ProjectStatus.IN_PROGRESS];
    const projects = await this.uow.projects.findActiveByBusinessId(
      businessId,
      dto.limit,
      statuses,
    );
    if (projects.length === 0) {
      return plainToInstance(
        BusinessProjectHealthResponseDto,
        { projects: [], generated_at: new Date().toISOString() },
        { excludeExtraneousValues: true },
      );
    }

    const projectIds = projects.map((p) => p.id);
    const now = new Date();
    const mtdStart = DateUtil.toDate(DateUtil.startOf(now, 'month'));

    const [healthRows, mtdSpendByProject] = await Promise.all([
      this.uow.tasks.aggregateHealthByProjectIds(projectIds),
      this.uow.businessTransactions.sumMtdSpendByProjectIds(projectIds, mtdStart, now),
    ]);

    const healthById = new Map<string, IProjectHealthAggregate>(
      healthRows.map((r) => [r.project_id, r]),
    );

    const items = projects.map((project) =>
      this.toItem(project, healthById.get(project.id), mtdSpendByProject.get(project.id)),
    );

    // At-risk first; within each tier, most-recently-active first.
    items.sort((a, b) => {
      if (a.is_at_risk !== b.is_at_risk) return a.is_at_risk ? -1 : 1;
      const aTime = a.last_activity_at ? Date.parse(a.last_activity_at) : 0;
      const bTime = b.last_activity_at ? Date.parse(b.last_activity_at) : 0;
      return bTime - aTime;
    });

    this.logger.log(
      `get — complete | businessId: ${businessId}, projects: ${items.length}, at_risk: ${items.filter((i) => i.is_at_risk).length}`,
    );

    return plainToInstance(
      BusinessProjectHealthResponseDto,
      { projects: items, generated_at: now.toISOString() },
      { excludeExtraneousValues: true },
    );
  }

  private toItem(
    project: Project,
    health: IProjectHealthAggregate | undefined,
    mtdSpend: string | undefined,
  ): {
    project_id: string;
    code: string;
    title: string;
    status: ProjectStatus;
    payment_type: Project['paymentType'];
    total_tasks: number;
    completed_tasks: number;
    in_review_tasks: number;
    overdue_tasks: number;
    completion_pct: string | null;
    mtd_spend: string;
    last_activity_at: string | null;
    is_at_risk: boolean;
  } {
    const total = health?.total ?? 0;
    const completed = health?.completed ?? 0;
    const inReview = health?.in_review ?? 0;
    const overdue = health?.overdue ?? 0;
    const completionPct = total > 0 ? ((completed / total) * 100).toFixed(1) : null;
    const lastActivity = health?.last_activity_at ?? null;
    const oldestInReview = health?.oldest_in_review_at ?? null;

    const reviewStale =
      oldestInReview !== null && Date.now() - oldestInReview.getTime() > STALE_REVIEW_MS;
    const isAtRisk = overdue > 0 || (inReview > 0 && reviewStale);

    return {
      project_id: project.id,
      code: project.code,
      title: project.title,
      status: project.status,
      payment_type: project.paymentType,
      total_tasks: total,
      completed_tasks: completed,
      in_review_tasks: inReview,
      overdue_tasks: overdue,
      completion_pct: completionPct,
      mtd_spend: mtdSpend ?? '0.00',
      last_activity_at: lastActivity ? lastActivity.toISOString() : null,
      is_at_risk: isAtRisk,
    };
  }
}
