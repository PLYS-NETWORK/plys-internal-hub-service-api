import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';

import { ERROR_CODES } from '@common/constants/error-codes';
import { ActivePlatform } from '@database/enums/active-platform.enum';
import { PLATFORM_KEY } from '@common/decorators/platform.decorator';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredPlatforms = this.reflector.getAllAndOverride<ActivePlatform[]>(PLATFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Platform() decorator → allow all platforms through.
    if (!requiredPlatforms || requiredPlatforms.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest & { user: JwtPayload }>();
    const user = request.user;

    if (!user || !requiredPlatforms.includes(user.activePlatform)) {
      throw new TranslatableException({
        messageKey: 'error.generic.forbidden',
        errorCode: ERROR_CODES.GENERIC_FORBIDDEN,
        status: 403,
      });
    }

    return true;
  }
}
