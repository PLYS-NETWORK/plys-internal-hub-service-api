import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Gateway stand-ins for profiles-service skill-exam guards.
 * The gRPC bridge invokes controller methods directly (no Nest guards), so
 * enforcement for mutating skill-exam operations happens in profiles-service.
 */
@Injectable()
export class GatewayNotBannedGuard implements CanActivate {
  public canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

@Injectable()
export class GatewayOnboardingApprovedGuard implements CanActivate {
  public canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}
