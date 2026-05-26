import { HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { DateUtil } from '@plys/libraries/common-nest/utils/date';
import { Currency } from '@plys/libraries/database/enums';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { BusinessSpendTrendDto } from '../../../dto/requests/business-spend-trend.dto';
import { BusinessSpendTrendResponseDto } from '../../../dto/responses/business-spend-trend-response.dto';
import { IBusinessSpendTrendService } from '../interfaces/business-spend-trend-service.interface';

@Injectable()
export class BusinessSpendTrendService implements IBusinessSpendTrendService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(BusinessSpendTrendService.name, requestContext);
  }

  /** @inheritdoc */
  public async get(dto: BusinessSpendTrendDto): Promise<BusinessSpendTrendResponseDto> {
    const userId = this.requestContext.userId!;
    const businessProfile = await this.uow.businessProfiles.findByUserId(userId);
    if (!businessProfile) {
      throw new TranslatableException({
        messageKey: 'error.business_profile.not_found',
        errorCode: ERROR_CODES.BUSINESS_PROFILE_NOT_FOUND,
        status: HttpStatus.FORBIDDEN,
      });
    }

    // Window defaults to the last 6 calendar months ending now.
    const to = dto.to ? DateUtil.toDate(dto.to) : new Date();
    const from = dto.from
      ? DateUtil.toDate(dto.from)
      : DateUtil.toDate(DateUtil.subtract(to, 6, 'month'));

    this.logger.log(
      `get — start | businessId: ${businessProfile.id}, from: ${from.toISOString()}, to: ${to.toISOString()}, granularity: ${dto.granularity}`,
    );

    const buckets = await this.uow.businessTransactions.sumBusinessOutflowGroupedByPeriod(
      businessProfile.id,
      from,
      to,
      dto.granularity,
    );

    // Compute running cumulative as we walk the ordered series.
    let cumulative = 0;
    const points = buckets.map((b) => {
      cumulative += Number(b.amount);
      return {
        period_label: b.period_label,
        spend: b.amount,
        cumulative: cumulative.toFixed(2),
      };
    });

    this.logger.log(`get — complete | buckets: ${points.length}`);

    return plainToInstance(
      BusinessSpendTrendResponseDto,
      {
        currency: Currency.USD,
        granularity: dto.granularity,
        points,
      },
      { excludeExtraneousValues: true },
    );
  }
}
