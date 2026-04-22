import { ERROR_CODES } from '@common/constants/error-codes';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContextService,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;
    // JwtContextMiddleware already verified the token and populated the context.
    // If userId is still null the Authorization header was absent entirely.
    // (Expired / invalid / device-mismatch cases are thrown by the middleware.)
    if (!this.requestContext.userId) {
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    return true;
  }
}
