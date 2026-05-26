import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@plys/libraries/common-nest/decorators/roles.decorator';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { UserRole } from '@plys/libraries/database/enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContextService,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const userRole = this.requestContext.userRole;
    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
