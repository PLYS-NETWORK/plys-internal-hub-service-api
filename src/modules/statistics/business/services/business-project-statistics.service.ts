import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { Injectable } from '@nestjs/common';

import { AbstractProjectStatisticsService } from '../../shared/services/abstract-project-statistics.service';
import { BusinessStatisticsScope } from '../scopes/business-statistics.scope';

@Injectable()
export class BusinessProjectStatisticsService extends AbstractProjectStatisticsService {
  constructor(
    uow: UnitOfWorkService,
    requestContext: RequestContextService,
    scope: BusinessStatisticsScope,
  ) {
    super(uow, requestContext, scope, BusinessProjectStatisticsService.name);
  }
}
