import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { DateUtil } from '@plys/libraries/common-nest/utils/date';
import { ConsultantTransactionType, Currency } from '@plys/libraries/database/enums';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ConsultantEarningsTrendDto } from '../../../dto/requests/consultant-earnings-trend.dto';
import { ConsultantEarningsTrendResponseDto } from '../../../dto/responses/consultant-earnings-trend-response.dto';
import { IConsultantEarningsTrendService } from '../interfaces/consultant-earnings-trend-service.interface';

const TRACKED_TYPES: readonly ConsultantTransactionType[] = [
  ConsultantTransactionType.CREDIT_CLEARED,
  ConsultantTransactionType.CREDIT_PENDING,
  ConsultantTransactionType.WITHDRAWAL,
];

interface ITrendAggregator {
  earned: number;
  pending: number;
  withdrawn: number;
}

@Injectable()
export class ConsultantEarningsTrendService implements IConsultantEarningsTrendService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(ConsultantEarningsTrendService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(dto: ConsultantEarningsTrendDto): Promise<ConsultantEarningsTrendResponseDto> {
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
    const to = dto.to ? DateUtil.toDate(dto.to) : now;
    const from = dto.from
      ? DateUtil.toDate(dto.from)
      : DateUtil.toDate(DateUtil.subtract(to, 6, 'month'));

    this.logger.log(
      `get — start | consultantId: ${consultantId}, from: ${from.toISOString()}, to: ${to.toISOString()}, granularity: ${dto.granularity}`,
    );

    const buckets = await this.uow.consultantTransactions.sumByConsultantGroupedByPeriodAndType(
      consultantId,
      [...TRACKED_TYPES],
      from,
      to,
      dto.granularity,
    );

    // Merge the (period, type) rows into one row per period with the three
    // metrics filled in. Preserve the natural Postgres ordering by walking
    // through the rows once.
    const byPeriod = new Map<string, ITrendAggregator>();
    for (const bucket of buckets) {
      const existing = byPeriod.get(bucket.period_label) ?? {
        earned: 0,
        pending: 0,
        withdrawn: 0,
      };
      const amount = Number(bucket.amount);
      switch (bucket.type) {
        case ConsultantTransactionType.CREDIT_CLEARED:
          existing.earned += amount;
          break;
        case ConsultantTransactionType.CREDIT_PENDING:
          existing.pending += amount;
          break;
        case ConsultantTransactionType.WITHDRAWAL:
          existing.withdrawn += amount;
          break;
        default:
          break;
      }
      byPeriod.set(bucket.period_label, existing);
    }

    const sortedLabels = Array.from(byPeriod.keys()).sort();
    let cumulative = 0;
    const points = sortedLabels.map((label) => {
      const agg = byPeriod.get(label)!;
      cumulative += agg.earned;
      return {
        period_label: label,
        earned: agg.earned.toFixed(2),
        pending: agg.pending.toFixed(2),
        withdrawn: agg.withdrawn.toFixed(2),
        cumulative_earned: cumulative.toFixed(2),
      };
    });

    this.logger.log(`get — complete | buckets: ${points.length}`);

    return plainToInstance(
      ConsultantEarningsTrendResponseDto,
      {
        currency: Currency.USD,
        granularity: dto.granularity,
        points,
        generated_at: now.toISOString(),
      },
      { excludeExtraneousValues: true },
    );
  }
}
