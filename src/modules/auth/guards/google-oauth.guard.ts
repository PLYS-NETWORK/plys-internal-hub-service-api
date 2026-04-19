import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  // Pass the `state` query parameter (active_platform + redirect info)
  // through to Google so it survives the round-trip callback.
  public getAuthenticateOptions(context: ExecutionContext): Record<string, unknown> {
    const request = context.switchToHttp().getRequest<{ query: Record<string, string> }>();
    const state = request.query['state'] ?? '';
    return { state };
  }
}
