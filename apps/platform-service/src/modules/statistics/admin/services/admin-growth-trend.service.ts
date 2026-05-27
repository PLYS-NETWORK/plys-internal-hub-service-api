import { Injectable } from '@nestjs/common';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { DateUtil } from '@plys/libraries/common-nest/utils/date';
import { ActivePlatform, Currency } from '@plys/libraries/database/enums';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { AdminGrowthTrendDto } from '../../dto/requests/admin-growth-trend.dto';
import { AdminGrowthTrendResponseDto } from '../../dto/responses/admin-growth-trend-response.dto';
import { IAdminGrowthTrendService } from '../interfaces/admin-growth-trend-service.interface';

interface IPoint {
  period_label: string;
  new_consultants: number;
  new_businesses: number;
  gmv: string;
  payouts: string;
}

@Injectable()
export class AdminGrowthTrendService implements IAdminGrowthTrendService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(AdminGrowthTrendService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(dto: AdminGrowthTrendDto): Promise<AdminGrowthTrendResponseDto> {
    // Default to the last 6 calendar months ending now when caller omits the
    // window. Keeps the FE simple — no need to compute defaults client-side.
    const to = dto.to ? DateUtil.toDate(dto.to) : new Date();
    const from = dto.from
      ? DateUtil.toDate(dto.from)
      : DateUtil.toDate(DateUtil.subtract(to, 6, 'month'));

    this.logger.log(
      `get — start | from: ${from.toISOString()}, to: ${to.toISOString()}, granularity: ${dto.granularity}`,
    );

    const [users, gmv, payouts] = await Promise.all([
      this.uow.users.countNewByPlatformGroupedByPeriod(from, to, dto.granularity),
      this.uow.businessTransactions.sumGmvGroupedByPeriod(from, to, dto.granularity),
      this.uow.consultantTransactions.sumPayoutsGroupedByPeriod(from, to, dto.granularity),
    ]);

    // Align all three series onto a single set of period_labels. Buckets with
    // no rows for a metric land as 0 / '0.00' (never absent) so the FE can
    // render a contiguous chart without gap-checking each series.
    const points = new Map<string, IPoint>();
    const ensure = (label: string): IPoint => {
      let p = points.get(label);
      if (!p) {
        p = {
          period_label: label,
          new_consultants: 0,
          new_businesses: 0,
          gmv: '0.00',
          payouts: '0.00',
        };
        points.set(label, p);
      }
      return p;
    };

    for (const u of users) {
      const p = ensure(u.period_label);
      if (u.platform === ActivePlatform.CONSULTANT) p.new_consultants = u.count;
      else if (u.platform === ActivePlatform.BUSINESS) p.new_businesses = u.count;
    }
    for (const g of gmv) ensure(g.period_label).gmv = g.amount;
    for (const w of payouts) ensure(w.period_label).payouts = w.amount;

    const sorted = Array.from(points.values()).sort((a, b) =>
      a.period_label.localeCompare(b.period_label),
    );

    this.logger.log(`get — complete | buckets: ${sorted.length}`);

    return plainToInstance(
      AdminGrowthTrendResponseDto,
      {
        granularity: dto.granularity,
        currency: Currency.USD,
        points: sorted,
      },
      { excludeExtraneousValues: true },
    );
  }
}
