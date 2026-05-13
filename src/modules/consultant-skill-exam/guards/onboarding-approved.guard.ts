import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { OnboardingStatus } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class OnboardingApprovedGuard implements CanActivate {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly uow: UnitOfWorkService,
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
