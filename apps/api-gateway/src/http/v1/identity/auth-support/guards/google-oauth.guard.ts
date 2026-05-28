import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { ActivePlatform } from '@plys/libraries/database/enums';
import { FastifyRequest } from 'fastify';

import { OAuthStateStore } from '../oauth-state-store.service';

type RequestWithNonce = FastifyRequest & { __oauthStateNonce?: string };

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(
    private readonly envService: EnvironmentsService,
    private readonly oauthStateStore: OAuthStateStore,
  ) {
    super();
  }

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.envService.isGoogleOAuthConfigured) {
      throw new ServiceUnavailableException('Google OAuth is not configured on this server');
    }

    const request = context.switchToHttp().getRequest<RequestWithNonce>();
    const queryPlatform = (request.query as Record<string, string> | undefined)?.[
      'active_platform'
    ];
    const platform =
      queryPlatform === ActivePlatform.CONSULTANT
        ? ActivePlatform.CONSULTANT
        : ActivePlatform.BUSINESS;

    const nonce = await this.oauthStateStore.issue(platform);
    request.__oauthStateNonce = nonce;

    return (await super.canActivate(context)) as boolean;
  }

  public getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    const request = context.switchToHttp().getRequest<RequestWithNonce>();
    const state = request.__oauthStateNonce ?? '';
    return { state };
  }
}
