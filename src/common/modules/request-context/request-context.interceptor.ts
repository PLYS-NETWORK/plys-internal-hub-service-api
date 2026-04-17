import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';

import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContextService: RequestContextService) {}

  // Runs after guards — at this point request.user is populated by JwtAuthGuard.
  // We push the validated user identity into the AsyncLocalStorage context
  // so any service in the call chain can access it without receiving the request object.
  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: JwtPayload }>();

    const user = request.user;
    if (user) {
      this.requestContextService.setUser(user.sub, user.role, user.deviceId);
    }

    return next.handle();
  }
}
