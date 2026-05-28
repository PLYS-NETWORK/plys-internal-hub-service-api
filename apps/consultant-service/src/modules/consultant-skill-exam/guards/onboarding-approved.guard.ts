import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';

import { assertConsultantOnboardingApproved } from '../utils/skill-exam-access.util';

@Injectable()
export class OnboardingApprovedGuard implements CanActivate {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly uow: ProfilesUnitOfWorkService,
  ) {}

  public async canActivate(_context: ExecutionContext): Promise<boolean> {
    await assertConsultantOnboardingApproved(this.uow, this.requestContext.userId);
    return true;
  }
}
