import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ProfilesUnitOfWorkService } from '@plys/libraries/unit-of-work/profiles-unit-of-work.service';

@Injectable()
export class NotBannedGuard implements CanActivate {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly uow: ProfilesUnitOfWorkService,
  ) {}

  public async canActivate(_context: ExecutionContext): Promise<boolean> {
    const userId = this.requestContext.userId;
    if (!userId) {
      throw new TranslatableException({
        messageKey: 'error.skill_exam.user_banned',
        errorCode: ERROR_CODES.SKILL_EXAM_USER_BANNED,
        status: HttpStatus.FORBIDDEN,
      });
    }
    const user = await this.uow.users.findById(userId);
    if (!user || user.bannedAt !== null) {
      throw new TranslatableException({
        messageKey: 'error.skill_exam.user_banned',
        errorCode: ERROR_CODES.SKILL_EXAM_USER_BANNED,
        status: HttpStatus.FORBIDDEN,
        details: { ban_reason: user?.banReason ?? null },
      });
    }
    return true;
  }
}
