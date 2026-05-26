import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ERROR_CODES, ErrorCode } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { StandardizedResponse } from '@plys/libraries/common-nest/response/standardized-response';
import { FastifyRequest } from 'fastify';
import { I18nService } from 'nestjs-i18n';
import { QueryFailedError } from 'typeorm';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger: AppLogger;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly i18n: I18nService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(GlobalExceptionFilter.name, requestContext);
  }

  public catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const lang = this.requestContext.lang;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = this.translate('error.generic.internal_server_error', lang);
    let errorCode: ErrorCode = ERROR_CODES.GENERIC_INTERNAL_SERVER_ERROR;
    // 4xx errors can attach machine-readable context (e.g. `offending_task_ids`)
    // by setting `details` on TranslatableException; surfaced as `data` so
    // clients don't have to parse the human-readable message.
    let details: Record<string, unknown> | null = null;

    if (exception instanceof TranslatableException) {
      status = exception.getStatus();
      message = this.translate(exception.messageKey, lang, exception.args);
      errorCode = exception.errorCode;
      details = exception.details ?? null;
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
    const meta: Record<string, unknown> = {
      method: request.method,
      path: request.url,
      status,
      error_code: errorCode,
      ...(exception instanceof TranslatableException ? { error_key: exception.messageKey } : {}),
      ...(exception instanceof Error ? { error_message: exception.message } : {}),
    };

    if (status >= 500) {
      this.logger.error(
        'request failed',
        exception instanceof Error ? exception.stack : undefined,
        meta,
      );
    } else {
      this.logger.warn('request failed', meta);
    }

    const requestId = this.requestContext.requestId;
    const deviceId = (request.headers as Record<string, string | undefined>)['x-device-id'] ?? null;
    const body = new StandardizedResponse<Record<string, unknown> | null>(
      status,
      message,
      details,
      request.url,
      errorCode,
      requestId,
      deviceId,
    );
    httpAdapter.reply(ctx.getResponse(), body, status);
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
