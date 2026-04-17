import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';

import { IRequestContext } from './interfaces/request-context.interface';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  public use(req: FastifyRequest, _res: FastifyReply, next: () => void): void {
    const context: IRequestContext = {
      // Use Fastify's built-in request id if available, otherwise generate one
      requestId: (req.id as string) ?? randomUUID(),
      userId: null, // populated by RequestContextInterceptor after JWT guard runs
      userRole: null,
      deviceId: null,
      // Prefer X-Forwarded-For for real IP behind a proxy/load-balancer
      ipAddress:
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ??
        req.ip ??
        '',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
      path: req.url,
      method: req.method,
    };

    this.requestContextService.run(context, next);
  }
}
