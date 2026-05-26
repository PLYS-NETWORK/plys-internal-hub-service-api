import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { OnboardingStatus } from '@plys/libraries/database/enums';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';

@Injectable()
export class OnboardingApprovedGuard implements CanActivate {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly uow: ProfilesUnitOfWorkService,
  ) {}

  public async canActivate(_context: ExecutionContext): Promise<boolean> {
    const userId = this.requestContext.userId;
    if (!userId) {
      throw new TranslatableException({
        messageKey: 'error.consultant_onboarding.not_approved',
        errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_NOT_APPROVED,
        status: HttpStatus.FORBIDDEN,
      });
    }
    const onboarding = await this.uow.consultantOnboardings.findByUserId(userId);
    if (!onboarding || onboarding.status !== OnboardingStatus.APPROVED) {
      throw new TranslatableException({
        messageKey: 'error.consultant_onboarding.not_approved',
        errorCode: ERROR_CODES.CONSULTANT_ONBOARDING_NOT_APPROVED,
        status: HttpStatus.FORBIDDEN,
      });
    }
    return true;
  }
}
