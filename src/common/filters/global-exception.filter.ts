import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { I18nService } from 'nestjs-i18n';
import { QueryFailedError } from 'typeorm';

import { TranslatableException } from '../exceptions/translatable.exception';
import { RequestContextService } from '../modules/request-context/request-context.service';
import { StandardizedResponse } from '../response/standardized-response';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly requestContext: RequestContextService,
  ) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();
    const lang = this.requestContext.lang;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = this.translate('error.generic.internal_server_error', lang);

    if (exception instanceof TranslatableException) {
      status = exception.getStatus();
      message = this.translate(exception.messageKey, lang, exception.args);
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const typed = exceptionResponse as { message?: string | string[]; error?: string };
        message = Array.isArray(typed.message)
          ? typed.message.join('; ')
          : (typed.message ?? typed.error ?? exception.message);
      }
    } else if (exception instanceof QueryFailedError) {
      const driverError = exception.driverError as { code?: string };
      switch (driverError?.code) {
        case '23505':
          status = HttpStatus.CONFLICT;
          message = this.translate('error.database.unique_violation', lang);
          break;
        case '23503':
          status = HttpStatus.UNPROCESSABLE_ENTITY;
          message = this.translate('error.database.foreign_key_violation', lang);
          break;
        case '23502':
          status = HttpStatus.UNPROCESSABLE_ENTITY;
          message = this.translate('error.database.not_null_violation', lang);
          break;
        default:
          status = HttpStatus.UNPROCESSABLE_ENTITY;
          message = this.translate('error.generic.bad_request', lang);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    this.logger.error(
      `[${request.method}] ${request.url} → ${status}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const body = new StandardizedResponse<null>(status, message, null, request.url);
    response.status(status).send(body);
  }

  private translate(key: string, lang: string, args?: Record<string, string | number>): string {
    try {
      return this.i18n.translate(key, { lang, args }) as string;
    } catch {
      return key;
    }
  }
}
