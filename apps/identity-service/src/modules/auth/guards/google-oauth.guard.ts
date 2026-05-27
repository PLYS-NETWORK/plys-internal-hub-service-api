import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { ActivePlatform } from '@plys/libraries/database/enums';
import { FastifyRequest } from 'fastify';

import { OAuthStateStore } from '../services/oauth-state-store.service';

// Augments FastifyRequest with the per-request nonce we stash for the
// downstream getAuthenticateOptions to read.
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

    // Resolve the platform the user wants to register / sign in for. Default to
    // BUSINESS — the source of truth across the round-trip is the *server-side*
    // record we persist below; the URL is only a hint for the initial request.
    const request = context.switchToHttp().getRequest<RequestWithNonce>();
    const queryPlatform = (request.query as Record<string, string> | undefined)?.[
      'active_platform'
    ];
    const platform =
      queryPlatform === ActivePlatform.CONSULTANT
        ? ActivePlatform.CONSULTANT
        : ActivePlatform.BUSINESS;

    // Issue a CSRF nonce, persist `{ activePlatform }` in Redis, and stash the
    // nonce on the request so getAuthenticateOptions can pass it to Google.
    const nonce = await this.oauthStateStore.issue(platform);
    request.__oauthStateNonce = nonce;

    return (await super.canActivate(context)) as boolean;
  }

  // Pass the random nonce as `state` to Google. Google echoes it back on
  // callback and the callback handler validates it against Redis.
  public getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    const request = context.switchToHttp().getRequest<RequestWithNonce>();
    const state = request.__oauthStateNonce ?? '';
    return { state };
  }
}
