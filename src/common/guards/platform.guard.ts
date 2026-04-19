import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ERROR_CODES } from '@common/constants/error-codes';
import { PLATFORM_KEY } from '@common/decorators/platform.decorator';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ActivePlatform } from '@database/enums/active-platform.enum';

@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContextService,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredPlatforms = this.reflector.getAllAndOverride<ActivePlatform[]>(PLATFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPlatforms || requiredPlatforms.length === 0) return true;

    const activePlatform = this.requestContext.activePlatform;
    if (!activePlatform || !requiredPlatforms.includes(activePlatform)) {
      throw new TranslatableException({
        messageKey: 'error.generic.forbidden',
        errorCode: ERROR_CODES.GENERIC_FORBIDDEN,
        status: 403,
      });
    }

    return true;
  }
}
