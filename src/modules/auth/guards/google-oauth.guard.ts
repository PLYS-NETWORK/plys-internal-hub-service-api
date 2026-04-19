import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

import { EnvironmentsService } from '@common/modules/environments';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(private readonly envService: EnvironmentsService) {
    super();
  }

  public canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    if (!this.envService.isGoogleOAuthConfigured) {
      throw new ServiceUnavailableException('Google OAuth is not configured on this server');
    }
    return super.canActivate(context);
  }

  // Pass the `state` query parameter (active_platform + redirect info)
  // through to Google so it survives the round-trip callback.
  public getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    const request = context.switchToHttp().getRequest<{ query: Record<string, string> }>();
    const state = request.query['state'] ?? '';
    return { state };
  }
}
