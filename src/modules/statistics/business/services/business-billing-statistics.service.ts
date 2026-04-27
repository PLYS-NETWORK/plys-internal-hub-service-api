import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';

import { AbstractBillingStatisticsService } from '../../shared/services/abstract-billing-statistics.service';
import { BusinessStatisticsScope } from '../scopes/business-statistics.scope';

@Injectable()
export class BusinessBillingStatisticsService extends AbstractBillingStatisticsService {
  constructor(
    uow: UnitOfWorkService,
    requestContext: RequestContextService,
    scope: BusinessStatisticsScope,
  ) {
    super(uow, requestContext, scope, BusinessBillingStatisticsService.name);
  }
}
