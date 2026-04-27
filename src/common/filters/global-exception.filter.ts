import { ERROR_CODES, ErrorCode } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { StandardizedResponse } from '@common/response/standardized-response';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { I18nService } from 'nestjs-i18n';
import { QueryFailedError } from 'typeorm';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger: AppLogger;

  constructor(
    private readonly i18n: I18nService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(GlobalExceptionFilter.name, requestContext);
  }

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();
    const lang = this.requestContext.lang;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = this.translate('error.generic.internal_server_error', lang);
    let errorCode: ErrorCode = ERROR_CODES.GENERIC_INTERNAL_SERVER_ERROR;

    if (exception instanceof TranslatableException) {
      status = exception.getStatus();
      message = this.translate(exception.messageKey, lang, exception.args);
      errorCode = exception.errorCode;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      errorCode = this.mapHttpStatusToErrorCode(status);

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const typed = exceptionResponse as { message?: string | string[]; error?: string };
        message = Array.isArray(typed.message)
          ? typed.message.join('; ')
          : (typed.message ?? typed.error ?? exception.message);
      }
    } else if (exception instanceof QueryFailedError) {
      const driverError = exception.driverError as { code?: string; message?: string };
      switch (driverError?.code) {
        case '23505':
          status = HttpStatus.CONFLICT;
          message = this.translate('error.database.unique_violation', lang);
          errorCode = ERROR_CODES.DATABASE_UNIQUE_VIOLATION;
          break;
        case '23503':
          status = HttpStatus.UNPROCESSABLE_ENTITY;
          message = this.translate('error.database.foreign_key_violation', lang);
          errorCode = ERROR_CODES.DATABASE_FOREIGN_KEY_VIOLATION;
          break;
        case '23502':
          status = HttpStatus.UNPROCESSABLE_ENTITY;
          message = this.translate('error.database.not_null_violation', lang);
          errorCode = ERROR_CODES.DATABASE_NOT_NULL_VIOLATION;
          break;
        // P0001 — `RAISE EXCEPTION` from a PL/pgSQL trigger. Used by
        // `trg_enforce_project_status` to reject illegal status transitions.
        // Surface as a domain error so callers see a stable code.
        case 'P0001': {
          const triggerMessage = driverError?.message ?? '';
          if (/project.*status/i.test(triggerMessage)) {
            status = HttpStatus.UNPROCESSABLE_ENTITY;
            message = this.translate('error.project.invalid_status_transition', lang);
            errorCode = ERROR_CODES.PROJECT_INVALID_STATUS_TRANSITION;
          } else {
            status = HttpStatus.UNPROCESSABLE_ENTITY;
            message = this.translate('error.generic.bad_request', lang);
            errorCode = ERROR_CODES.GENERIC_BAD_REQUEST;
          }
          break;
        }
        default:
          status = HttpStatus.UNPROCESSABLE_ENTITY;
          message = this.translate('error.generic.bad_request', lang);
          errorCode = ERROR_CODES.GENERIC_BAD_REQUEST;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Log severity is driven by the response status. 5xx are real server
    // problems (we want stack traces and ERROR alerts); 4xx are normal client
    // mishaps (expired token, validation, missing resource) that would create
    // alert noise if treated as errors. We drop the stack for 4xx and downgrade
    // to WARN so dashboards stay clean.
    const detail = this.formatLogDetail(exception, errorCode, status, request);
    if (status >= 500) {
      this.logger.error(detail, exception instanceof Error ? exception.stack : String(exception));
    } else {
      this.logger.warn(detail);
    }

    const requestId = this.requestContext.requestId;
    const deviceId = (request.headers as Record<string, string | undefined>)['x-device-id'] ?? null;
    const body = new StandardizedResponse<null>(
      status,
      message,
      null,
      request.url,
      errorCode,
      requestId,
      deviceId,
    );
    response.code(status).send(body);
  }

  // Builds a single, diagnostic log line. Avoids the useless default
  // "Translatable Exception" string from HttpException's superclass by
  // pulling `messageKey` out of the typed exception.
  private formatLogDetail(
    exception: unknown,
    errorCode: ErrorCode,
    status: number,
    request: FastifyRequest,
  ): string {
    const base = `[${request.method}] ${request.url} → ${status} | code: ${errorCode}`;
    if (exception instanceof TranslatableException) {
      return `${base}, key: ${exception.messageKey}`;
    }
    if (exception instanceof Error) {
      return `${base}, error: ${exception.message}`;
    }
    return base;
  }

  private mapHttpStatusToErrorCode(status: number): ErrorCode {
    const map: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ERROR_CODES.GENERIC_BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ERROR_CODES.GENERIC_UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ERROR_CODES.GENERIC_FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ERROR_CODES.GENERIC_NOT_FOUND,
      [HttpStatus.CONFLICT]: ERROR_CODES.GENERIC_CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.GENERIC_UNPROCESSABLE,
    };
    return map[status] ?? ERROR_CODES.GENERIC_INTERNAL_SERVER_ERROR;
  }

  private translate(key: string, lang: string, args?: Record<string, string | number>): string {
    try {
      return this.i18n.translate(key, { lang, args }) as string;
    } catch {
      return key;
    }
  }
}
