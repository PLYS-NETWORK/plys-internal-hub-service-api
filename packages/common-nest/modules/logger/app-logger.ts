import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

import { appWinstonLogger } from './winston.config';

/**
 * Structured logger for @Injectable services. Emits JSON payloads via the
 * shared Winston instance (defined in winston.config.ts) so Loki can index
 * `context`, `request_id`, `user_id`, and any extra `meta` keys as fields.
 *
 * Usage (in any @Injectable service):
 *   private readonly logger: AppLogger;
 *   constructor(private readonly requestContext: RequestContextService) {
 *     this.logger = new AppLogger(MyService.name, requestContext);
 *   }
 *
 * Existing callers keep using `logger.log(message)` — backward compatible.
 * New call sites can pass structured meta:
 *   logger.log('user created', { user_id, business_id })
 */
export class AppLogger {
  constructor(
    private readonly contextName: string,
    private readonly requestContext: RequestContextService,
  ) {}

  public log(message: string, meta?: Record<string, unknown>): void {
    appWinstonLogger.info(this.payload(message, meta));
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    appWinstonLogger.warn(this.payload(message, meta));
  }

  public error(message: string, stack?: string, meta?: Record<string, unknown>): void {
    appWinstonLogger.error({ ...this.payload(message, meta), stack });
  }

  private payload(message: string, meta?: Record<string, unknown>): Record<string, unknown> {
    return {
      context: this.contextName,
      request_id: this.requestContext.requestId || undefined,
      user_id: this.requestContext.userId ?? undefined,
      message,
      ...meta,
    };
  }
}
