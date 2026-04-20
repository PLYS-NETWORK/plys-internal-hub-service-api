import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
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
    // If userId is still null the token was absent, invalid, or expired.
    if (!this.requestContext.userId) {
      throw new UnauthorizedException('Invalid or missing authentication token');
    }

    return true;
  }
}
