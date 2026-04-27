import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Money } from '@common/utils/money';
import { Currency, ProjectStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { DashboardSummaryResponseDto } from '../../dto/responses/dashboard-summary-response.dto';
import { IDashboardSummaryService, IStatisticsScope } from '../interfaces';

const PUBLISHED_LIFECYCLE: readonly ProjectStatus[] = [
  ProjectStatus.PUBLIC,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.DONE,
];

/**
 * Computes the four KPI cards in a single batched call. All sub-queries run
 * in parallel — there is no read-after-read dependency.
 */
export abstract class AbstractDashboardSummaryService implements IDashboardSummaryService {
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
  public async get(): Promise<DashboardSummaryResponseDto> {
    this.logger.log('get — start');

    // Resolve identifiers once; sub-calls run in parallel afterwards.
    const businessId = await this.scope.getBusinessId();
    const projectIds = await this.scope.getOwnedProjectIds();

    const [byStatus, openTasks, overdueTasks, pendingApps, spendSummary] = await Promise.all([
      this.uow.projects.countByBusinessIdGroupedByStatus(businessId),
      this.uow.tasks.countOpenByProjectIds(projectIds),
      this.uow.tasks.countOverdueByProjectIds(projectIds),
      this.uow.projectApplications.countPendingByProjectIds(projectIds),
      this.uow.businessTransactions.getPublishingSpendSummaryByBusinessId(businessId),
    ]);

    const total = Object.values(byStatus).reduce((acc, n) => acc + n, 0);
    const published = PUBLISHED_LIFECYCLE.reduce((acc, s) => acc + byStatus[s], 0);
    const draft = byStatus[ProjectStatus.DRAFT];

    this.logger.log(
      `get — complete | projects: ${total}, open_tasks: ${openTasks}, pending_apps: ${pendingApps}`,
    );

    return plainToInstance(
      DashboardSummaryResponseDto,
      {
        projects: { total, published, draft },
        tasks: { total_open: openTasks, overdue_count: overdueTasks },
        applications: { pending_count: pendingApps },
        billing: {
          total_spend: Money.from(spendSummary.total_spend).toFixedString(),
          currency: Currency.USD,
        },
        generated_at: new Date(),
      },
      { excludeExtraneousValues: true },
    );
  }
}
