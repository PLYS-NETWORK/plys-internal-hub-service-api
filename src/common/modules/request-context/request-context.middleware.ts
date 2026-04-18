import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';

import {
  DEFAULT_LOCALE,
  IRequestContext,
  SUPPORTED_LOCALES,
  SupportedLocale,
} from './interfaces/request-context.interface';
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
      lang: this.resolveLocale(req),
    };

    this.requestContextService.run(context, next);
  }

  // Resolution order: custom `lang` header → Accept-Language → default `en`.
  // Unsupported locales fall back silently so clients never get a 400 for a bad header.
  private resolveLocale(req: FastifyRequest): SupportedLocale {
    const explicit = (req.headers['lang'] as string | undefined)?.toLowerCase().trim();
    if (explicit && this.isSupported(explicit)) {
      return explicit;
    }

    const acceptLanguage = req.headers['accept-language'] as string | undefined;
    if (acceptLanguage) {
      // Parse "en-US,en;q=0.9,tr;q=0.8" — take the first token of each entry, in order.
      for (const entry of acceptLanguage.split(',')) {
        const tag = entry.split(';')[0].trim().toLowerCase().split('-')[0];
        if (this.isSupported(tag)) {
          return tag;
        }
      }
    }

    return DEFAULT_LOCALE;
  }

  private isSupported(value: string): value is SupportedLocale {
    return (SUPPORTED_LOCALES as readonly string[]).includes(value);
  }
}
