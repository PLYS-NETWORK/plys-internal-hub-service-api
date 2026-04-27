import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { PendingApplicationsDto } from '../../dto/requests/pending-applications.dto';
import { StatsDateRangeDto } from '../../dto/requests/stats-date-range.dto';
import { ApplicationFunnelResponseDto } from '../../dto/responses/application-funnel-response.dto';
import { ApplicationsPerProjectResponseDto } from '../../dto/responses/applications-per-project-response.dto';
import { PendingApplicationsResponseDto } from '../../dto/responses/pending-applications-response.dto';
import { IApplicationStatisticsService, IStatisticsScope } from '../interfaces';

export abstract class AbstractApplicationStatisticsService implements IApplicationStatisticsService {
  protected readonly logger: AppLogger;

  protected constructor(
    protected readonly uow: UnitOfWorkService,
    protected readonly requestContext: RequestContextService,
    protected readonly scope: IStatisticsScope,
    contextName: string,
  ) {
    this.logger = new AppLogger(contextName, requestContext);
  }

  /** @inheritdoc */
  public async getFunnel(query: StatsDateRangeDto): Promise<ApplicationFunnelResponseDto> {
    this.logger.log(`getFunnel — start | projectId: ${query.projectId ?? 'all'}`);
    const projectIds = await this.scope.getOwnedProjectIds();

    const [funnel, active] = await Promise.all([
      this.uow.projectApplications.countFunnelByProjectIds(
        projectIds,
        query.from,
        query.to,
        query.projectId,
      ),
      // The `active` stage of the funnel is the count of project members that
      // resulted from accepted applications — read from the authoritative roster.
      query.projectId
        ? this.uow.projectMembers.countActiveTotalByProjectIds([query.projectId])
        : this.uow.projectMembers.countActiveTotalByProjectIds(projectIds),
    ]);

    const stages = [
      { stage: 'applied' as const, count: funnel.applied, conversion_rate: null },
      {
        stage: 'reviewed' as const,
        count: funnel.reviewed,
        conversion_rate: ratio(funnel.reviewed, funnel.applied),
      },
      {
        stage: 'approved' as const,
        count: funnel.approved,
        conversion_rate: ratio(funnel.approved, funnel.reviewed),
      },
      {
        stage: 'active' as const,
        count: active,
        conversion_rate: ratio(active, funnel.approved),
      },
    ];

    const overall = funnel.applied === 0 ? 0 : roundRatio(active / funnel.applied);

    this.logger.log(
      `getFunnel — complete | applied: ${funnel.applied}, reviewed: ${funnel.reviewed}, approved: ${funnel.approved}, active: ${active}`,
    );

    return plainToInstance(
      ApplicationFunnelResponseDto,
      { stages, overall_conversion_rate: overall },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getPerProject(query: StatsDateRangeDto): Promise<ApplicationsPerProjectResponseDto> {
    this.logger.log(`getPerProject — start | projectId: ${query.projectId ?? 'all'}`);
    const projectIds = await this.scope.getOwnedProjectIds();

    const rows = await this.uow.projectApplications.countByProjectIdsGroupedByProjectAndStatus(
      projectIds,
      query.projectId,
    );

    this.logger.log(`getPerProject — complete | projects: ${rows.length}`);

    return plainToInstance(
      ApplicationsPerProjectResponseDto,
      { projects: rows },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getPending(query: PendingApplicationsDto): Promise<PendingApplicationsResponseDto> {
    this.logger.log(`getPending — start | page: ${query.page}, page_size: ${query.pageSize}`);
    const projectIds = await this.scope.getOwnedProjectIds();

    const [items, total] = await this.uow.projectApplications.findPendingByProjectIds(
      projectIds,
      query.skip,
      query.pageSize,
    );

    const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);

    this.logger.log(`getPending — complete | total: ${total}, returned: ${items.length}`);

    return plainToInstance(
      PendingApplicationsResponseDto,
      {
        total_pending: total,
        items,
        page: query.page,
        page_size: query.pageSize,
        total_pages: totalPages,
      },
      { excludeExtraneousValues: true },
    );
  }
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return roundRatio(numerator / denominator);
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}
