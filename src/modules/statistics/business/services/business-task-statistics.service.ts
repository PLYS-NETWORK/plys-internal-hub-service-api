import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';

import { AbstractTaskStatisticsService } from '../../shared/services/abstract-task-statistics.service';
import { BusinessStatisticsScope } from '../scopes/business-statistics.scope';

@Injectable()
export class BusinessTaskStatisticsService extends AbstractTaskStatisticsService {
  constructor(
    uow: UnitOfWorkService,
    requestContext: RequestContextService,
    scope: BusinessStatisticsScope,
  ) {
    super(uow, requestContext, scope, BusinessTaskStatisticsService.name);
  }
}
