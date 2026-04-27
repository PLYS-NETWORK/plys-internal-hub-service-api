import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';

import { AbstractApplicationStatisticsService } from '../../shared/services/abstract-application-statistics.service';
import { BusinessStatisticsScope } from '../scopes/business-statistics.scope';

@Injectable()
export class BusinessApplicationStatisticsService extends AbstractApplicationStatisticsService {
  constructor(
    uow: UnitOfWorkService,
    requestContext: RequestContextService,
    scope: BusinessStatisticsScope,
  ) {
    super(uow, requestContext, scope, BusinessApplicationStatisticsService.name);
  }
}
