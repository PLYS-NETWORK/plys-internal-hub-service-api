import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';

import { AbstractDashboardSummaryService } from '../../shared/services/abstract-dashboard-summary.service';
import { BusinessStatisticsScope } from '../scopes/business-statistics.scope';

@Injectable()
export class BusinessDashboardSummaryService extends AbstractDashboardSummaryService {
  constructor(
    uow: UnitOfWorkService,
    requestContext: RequestContextService,
    scope: BusinessStatisticsScope,
  ) {
    super(uow, requestContext, scope, BusinessDashboardSummaryService.name);
  }
}
