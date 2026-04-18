import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { I18nService } from 'nestjs-i18n';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { RequestContextService } from '../modules/request-context/request-context.service';
import { StandardizedResponse } from '../response/standardized-response';

// Shape controllers return when they want the `message` field translated.
// Any key under `src/i18n/<lang>/success.json` may be used, dotted (e.g. 'success.created').
export interface ITranslatedPayload<T> {
  readonly messageKey: string;
  readonly args?: Record<string, string | number>;
  readonly data: T;
}

// Recognize `{ messageKey, data }` without `instanceof` (would require a class everywhere).
function isTranslatedPayload<T>(value: unknown): value is ITranslatedPayload<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'messageKey' in value &&
    'data' in value &&
    typeof (value as { messageKey: unknown }).messageKey === 'string'
  );
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T | ITranslatedPayload<T>,
  StandardizedResponse<T>
> {
  constructor(
    private readonly i18n: I18nService,
    private readonly requestContext: RequestContextService,
  ) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler<T | ITranslatedPayload<T>>,
  ): Observable<StandardizedResponse<T>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    return next.handle().pipe(
      map((payload: T | ITranslatedPayload<T>) => {
        const lang = this.requestContext.lang;
        if (isTranslatedPayload<T>(payload)) {
          const message = this.translate(payload.messageKey, lang, payload.args);
          return new StandardizedResponse<T>(
            response.statusCode,
            message,
            payload.data,
            request.url,
          );
        }
        // No explicit messageKey — fall back to the translated default success.
        const message = this.translate('success.ok', lang);
        return new StandardizedResponse<T>(response.statusCode, message, payload as T, request.url);
      }),
    );
  }

  private translate(key: string, lang: string, args?: Record<string, string | number>): string {
    try {
      return this.i18n.translate(key, { lang, args }) as string;
    } catch {
      return key;
    }
  }
}
