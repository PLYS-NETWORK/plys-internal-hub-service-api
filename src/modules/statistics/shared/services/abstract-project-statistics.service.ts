import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ProjectStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ProjectsTrendDto, TrendPeriod } from '../../dto/requests/projects-trend.dto';
import { StatsDateRangeDto } from '../../dto/requests/stats-date-range.dto';
import { ProjectInterviewStatsResponseDto } from '../../dto/responses/project-interview-stats-response.dto';
import { ProjectStatsResponseDto } from '../../dto/responses/project-stats-response.dto';
import { ProjectTrendResponseDto } from '../../dto/responses/project-trend-response.dto';
import { IProjectStatisticsService, IStatisticsScope } from '../interfaces';

const PUBLISHED_LIFECYCLE: readonly ProjectStatus[] = [
  ProjectStatus.PUBLIC,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.DONE,
];

/**
 * Template-Method base for project statistics. Subclasses inject a
 * platform-specific `IStatisticsScope` and inherit the aggregation logic.
 */
export abstract class AbstractProjectStatisticsService implements IProjectStatisticsService {
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
  public async getStats(query: StatsDateRangeDto): Promise<ProjectStatsResponseDto> {
    this.logger.log(`getStats — start | from: ${query.from ?? 'none'}, to: ${query.to ?? 'none'}`);
    const businessId = await this.scope.getBusinessId();

    const byStatus = await this.uow.projects.countByBusinessIdGroupedByStatus(
      businessId,
      query.from,
      query.to,
    );

    const total = Object.values(byStatus).reduce((acc, n) => acc + n, 0);
    const publishedTotal = PUBLISHED_LIFECYCLE.reduce((acc, s) => acc + byStatus[s], 0);
    const publishedRatio = total === 0 ? 0 : roundRatio(publishedTotal / total);

    this.logger.log(`getStats — complete | total: ${total}, published_ratio: ${publishedRatio}`);

    return plainToInstance(
      ProjectStatsResponseDto,
      { total, by_status: byStatus, published_ratio: publishedRatio },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getTrend(query: ProjectsTrendDto): Promise<ProjectTrendResponseDto> {
    this.logger.log(`getTrend — start | period: ${query.period}, from: ${query.from ?? 'none'}`);
    const businessId = await this.scope.getBusinessId();

    const grouping = query.period === TrendPeriod.WEEKLY ? 'weekly' : 'monthly';
    const data = await this.uow.projects.countCreatedByBusinessIdGroupedByPeriod(
      businessId,
      grouping,
      query.from,
      query.to,
    );

    this.logger.log(`getTrend — complete | period: ${query.period}, points: ${data.length}`);

    return plainToInstance(
      ProjectTrendResponseDto,
      { period: query.period, data },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getInterviewStats(): Promise<ProjectInterviewStatsResponseDto> {
    this.logger.log('getInterviewStats — start');
    const projectIds = await this.scope.getOwnedProjectIds();
    const totalProjects = projectIds.length;

    const withQuestions =
      totalProjects === 0
        ? 0
        : await this.uow.projectInterviewQuestions.countDistinctProjectIds(projectIds);

    const withoutQuestions = totalProjects - withQuestions;
    const adoptionRate = totalProjects === 0 ? 0 : roundRatio(withQuestions / totalProjects);

    this.logger.log(
      `getInterviewStats — complete | total: ${totalProjects}, with_questions: ${withQuestions}`,
    );

    return plainToInstance(
      ProjectInterviewStatsResponseDto,
      {
        total_projects: totalProjects,
        with_questions_count: withQuestions,
        without_questions_count: withoutQuestions,
        adoption_rate: adoptionRate,
      },
      { excludeExtraneousValues: true },
    );
  }
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}
