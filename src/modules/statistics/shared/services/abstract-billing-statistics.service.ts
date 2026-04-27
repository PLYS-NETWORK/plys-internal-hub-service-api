import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Money } from '@common/utils/money';
import { Currency, ProjectStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { StatsDateRangeDto } from '../../dto/requests/stats-date-range.dto';
import { BillingDraftRatioResponseDto } from '../../dto/responses/billing-draft-ratio-response.dto';
import { BillingSpendTrendResponseDto } from '../../dto/responses/billing-spend-trend-response.dto';
import { BillingSummaryResponseDto } from '../../dto/responses/billing-summary-response.dto';
import { IBillingStatisticsService, IStatisticsScope } from '../interfaces';

const PUBLISHED_LIFECYCLE: readonly ProjectStatus[] = [
  ProjectStatus.PUBLIC,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.DONE,
];

export abstract class AbstractBillingStatisticsService implements IBillingStatisticsService {
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
  public async getSummary(): Promise<BillingSummaryResponseDto> {
    this.logger.log('getSummary — start');
    const businessId = await this.scope.getBusinessId();

    const summary =
      await this.uow.businessTransactions.getPublishingSpendSummaryByBusinessId(businessId);

    this.logger.log(
      `getSummary — complete | total_spend: ${summary.total_spend}, projects: ${summary.total_published_projects}`,
    );

    return plainToInstance(
      BillingSummaryResponseDto,
      {
        total_spend: Money.from(summary.total_spend).toFixedString(),
        currency: Currency.USD,
        total_published_projects: summary.total_published_projects,
        last_payment_at: summary.last_payment_at,
      },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getSpendTrend(query: StatsDateRangeDto): Promise<BillingSpendTrendResponseDto> {
    this.logger.log(`getSpendTrend — start | from: ${query.from ?? 'none'}`);
    const businessId = await this.scope.getBusinessId();

    const rows = await this.uow.businessTransactions.sumPublishingSpendByBusinessIdGroupedByMonth(
      businessId,
      query.from,
      query.to,
    );

    let cumulative = Money.zero();
    const data = rows.map((row) => {
      const amount = Money.from(row.amount);
      cumulative = cumulative.add(amount);
      return {
        period_label: row.period_label,
        amount: amount.toFixedString(),
        cumulative_amount: cumulative.toFixedString(),
      };
    });

    this.logger.log(`getSpendTrend — complete | points: ${data.length}`);

    return plainToInstance(
      BillingSpendTrendResponseDto,
      { currency: Currency.USD, data },
      { excludeExtraneousValues: true },
    );
  }

  /** @inheritdoc */
  public async getDraftRatio(): Promise<BillingDraftRatioResponseDto> {
    this.logger.log('getDraftRatio — start');
    const businessId = await this.scope.getBusinessId();

    const [byStatus, summary] = await Promise.all([
      this.uow.projects.countByBusinessIdGroupedByStatus(businessId),
      this.uow.businessTransactions.getPublishingSpendSummaryByBusinessId(businessId),
    ]);

    const draftCount = byStatus[ProjectStatus.DRAFT];
    const publishedCount = PUBLISHED_LIFECYCLE.reduce((acc, s) => acc + byStatus[s], 0);
    const totalCount = draftCount + publishedCount;
    const draftRatio = totalCount === 0 ? 0 : roundRatio(draftCount / totalCount);
    const publishedRatio = totalCount === 0 ? 0 : roundRatio(publishedCount / totalCount);

    // Average past publish price × draft_count. We compute the average internally
    // (NOT exposed) so the doc-spec "potential_revenue" remains a single field.
    let potentialRevenue = Money.zero();
    if (draftCount > 0 && summary.total_published_projects > 0) {
      const avg = Money.from(summary.total_spend).divInteger(summary.total_published_projects);
      potentialRevenue = avg.mulInteger(draftCount);
    }

    this.logger.log(
      `getDraftRatio — complete | drafts: ${draftCount}, published: ${publishedCount}, potential: ${potentialRevenue.toFixedString()}`,
    );

    return plainToInstance(
      BillingDraftRatioResponseDto,
      {
        draft_count: draftCount,
        published_count: publishedCount,
        total_count: totalCount,
        draft_ratio: draftRatio,
        published_ratio: publishedRatio,
        potential_revenue: potentialRevenue.toFixedString(),
        currency: Currency.USD,
      },
      { excludeExtraneousValues: true },
    );
  }
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}
