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
      requestId: randomUUID(),
      userId: null,
      email: null,
      userRole: null,
      sessionId: null,
      activePlatform: null,
      businessId: null,
      deviceId: null,
      ipAddress:
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ??
        req.ip ??
        '',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
      path: req.url,
      method: req.method,
      lang: this.resolveLocale(req),
      timezone: this.resolveTimezone(req),
    };

    this.requestContextService.run(context, next);
  }

  // Read `x-timezone`, trim, and accept only valid IANA zones. Anything
  // unrecognised (`Foo/Bar`, garbage, blank) collapses to null so downstream
  // helpers fall back to UTC instead of throwing on `dayjs.tz`.
  private resolveTimezone(req: FastifyRequest): string | null {
    const header = req.headers['x-timezone'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (typeof raw !== 'string') return null;

    const value = raw.trim();
    if (!value) return null;

    try {
      // Intl.DateTimeFormat throws RangeError for unsupported time zones.
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return value;
    } catch {
      return null;
    }
  }

  // Resolution order: custom `lang` header → Accept-Language → default `en`.
  private resolveLocale(req: FastifyRequest): SupportedLocale {
    const explicit = (req.headers['lang'] as string | undefined)?.toLowerCase().trim();
    if (explicit && this.isSupported(explicit)) {
      return explicit;
    }

    const acceptLanguage = req.headers['accept-language'] as string | undefined;
    if (acceptLanguage) {
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
