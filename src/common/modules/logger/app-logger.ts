import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Logger } from '@nestjs/common';

/**
 * Thin wrapper around NestJS `Logger` that automatically prepends
 * `[ContextName][requestId]` to every log line.
 *
 * Usage (in any @Injectable service):
 *   private readonly logger: AppLogger;
 *   constructor(private readonly requestContext: RequestContextService) {
 *     this.logger = new AppLogger(MyService.name, requestContext);
 *   }
 *
 * When called outside a request context (e.g. cron jobs, bootstrap),
 * the requestId segment is omitted gracefully.
 */
export class AppLogger {
  private readonly nestLogger: Logger;
  private readonly contextName: string;

  constructor(
    contextName: string,
    private readonly requestContext: RequestContextService,
  ) {
    this.contextName = contextName;
    this.nestLogger = new Logger(contextName);
  }

  private get prefix(): string {
    const rid = this.requestContext.requestId;
    return rid ? `[${rid}] ` : '';
  }

  public log(message: string): void {
    this.nestLogger.log(`${this.prefix}${message}`, this.contextName);
  }

  public warn(message: string): void {
    this.nestLogger.warn(`${this.prefix}${message}`, this.contextName);
  }

  public error(message: string, stack?: string): void {
    this.nestLogger.error(`${this.prefix}${message}`, stack, this.contextName);
  }
}
