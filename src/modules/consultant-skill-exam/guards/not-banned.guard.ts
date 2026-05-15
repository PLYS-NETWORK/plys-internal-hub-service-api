import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class NotBannedGuard implements CanActivate {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly uow: UnitOfWorkService,
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
