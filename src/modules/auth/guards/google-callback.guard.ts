import { EnvironmentsService } from '@common/modules/environments';
import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class GoogleCallbackGuard extends AuthGuard('google') {
  constructor(private readonly envService: EnvironmentsService) {
    super();
  }

  public canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    if (!this.envService.isGoogleOAuthConfigured) {
      throw new ServiceUnavailableException('Google OAuth is not configured on this server');
    }
    return super.canActivate(context);
  }
}
