import { Injectable, NestMiddleware } from '@nestjs/common';
import { IncomingMessage, ServerResponse } from 'http';

import { httpAccessLogger } from './http-logger.config';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  // Skip the liveness-probe path so Loki is not flooded with health checks.
  private readonly excludedPaths: ReadonlySet<string> = new Set(['/api/v1/health']);

  // NestJS with the Fastify adapter passes the raw Node.js IncomingMessage /
  // ServerResponse to middleware (not FastifyRequest / FastifyReply), so we
  // attach 'finish' / 'close' listeners on `res` directly — there is no `.raw`.
  // Also, middie rewrites `req.url` to the path *after* the matched wildcard
  // route ("/" for `forRoutes('*path')`) and preserves the full URL on
  // `req.originalUrl` — read that first so the log reflects the real endpoint.
  public use(
    req: IncomingMessage & { originalUrl?: string },
    res: ServerResponse,
    next: () => void,
  ): void {
    const method = req.method ?? 'UNKNOWN';
    const url = req.originalUrl ?? req.url ?? '';
    const path = url.split('?')[0];

    if (this.excludedPaths.has(path)) {
      next();
      return;
    }

    const start = process.hrtime.bigint();

    httpAccessLogger.info({ phase: 'start', method, url });

    let alreadyLogged = false;
    const onEnd = (): void => {
      if (alreadyLogged) return;
      alreadyLogged = true;
      const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
      httpAccessLogger.info({
        phase: 'end',
        method,
        url,
        status: res.statusCode,
        duration_ms: durationMs,
      });
    };

    res.once('finish', onEnd);
    res.once('close', onEnd);

    next();
  }
}
