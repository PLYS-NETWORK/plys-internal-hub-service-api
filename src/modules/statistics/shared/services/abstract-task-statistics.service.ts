import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { TaskKanbanStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { StatsDateRangeDto } from '../../dto/requests/stats-date-range.dto';
import { TaskStatsResponseDto } from '../../dto/responses/task-stats-response.dto';
import { TasksCompletionResponseDto } from '../../dto/responses/tasks-completion-response.dto';
import { TasksOverdueResponseDto } from '../../dto/responses/tasks-overdue-response.dto';
import { IStatisticsScope, ITaskStatisticsService } from '../interfaces';

export abstract class AbstractTaskStatisticsService implements ITaskStatisticsService {
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
  public async getStats(query: StatsDateRangeDto): Promise<TaskStatsResponseDto> {
    this.logger.log(`getStats — start | projectId: ${query.projectId ?? 'all'}`);

    const projectIds = await this.scope.getOwnedProjectIds();
    const byStatus = await this.uow.tasks.countByProjectIdsGroupedByStatus(
      projectIds,
      query.projectId,
    );

    // total_open excludes cancelled (per the doc — KPI surfaces "active workload").
    const totalOpen = Object.entries(byStatus).reduce(
      (acc, [status, count]) => (status === TaskKanbanStatus.CANCELLED ? acc : acc + count),
      0,
    );

    this.logger.log(`getStats — complete | total_open: ${totalOpen}`);

    return plainToInstance(
      TaskStatsResponseDto,
      { total_open: totalOpen, by_status: byStatus },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getOverdue(query: StatsDateRangeDto): Promise<TasksOverdueResponseDto> {
    this.logger.log(`getOverdue — start | projectId: ${query.projectId ?? 'all'}`);
    const projectIds = await this.scope.getOwnedProjectIds();

    const byProject = await this.uow.tasks.countOverdueByProjectIdsGroupedByProject(
      projectIds,
      query.projectId,
    );
    const overdueCount = byProject.reduce((acc, r) => acc + r.overdue_count, 0);

    this.logger.log(
      `getOverdue — complete | total: ${overdueCount}, projects: ${byProject.length}`,
    );

    return plainToInstance(
      TasksOverdueResponseDto,
      { overdue_count: overdueCount, by_project: byProject },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getCompletion(query: StatsDateRangeDto): Promise<TasksCompletionResponseDto> {
    this.logger.log(`getCompletion — start | projectId: ${query.projectId ?? 'all'}`);
    const projectIds = await this.scope.getOwnedProjectIds();

    const rows = await this.uow.tasks.countCompletionByProjectIdsGroupedByProject(
      projectIds,
      query.projectId,
    );

    const projects = rows
      .map((r) => ({
        project_id: r.project_id,
        project_name: r.project_name,
        total_tasks: r.total_tasks,
        completed_tasks: r.completed_tasks,
        completion_rate: r.total_tasks === 0 ? 0 : roundRatio(r.completed_tasks / r.total_tasks),
      }))
      .sort((a, b) => b.completion_rate - a.completion_rate);

    this.logger.log(`getCompletion — complete | projects: ${projects.length}`);

    return plainToInstance(
      TasksCompletionResponseDto,
      { projects },
      { excludeExtraneousValues: true },
    );
  }
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}
