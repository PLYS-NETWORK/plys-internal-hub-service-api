import { Injectable } from '@nestjs/common';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';

@Injectable()
export class UsersService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(UsersService.name, requestContext);
  }
}
