import { Metadata, status as GrpcStatus } from '@grpc/grpc-js';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES, ErrorCode } from '@plys/libraries/common-nest/constants/error-codes';
import { mapPostgresError } from '@plys/libraries/common-nest/errors/postgres-error.mapper';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { QueryFailedError } from 'typeorm';

import {
  IGrpcBridgeErrorPayload,
  IGrpcBridgeSuccessPayload,
  IHttpResponse,
} from './grpc-http.types';

export function buildSuccessResponse<T>(
  payload: IGrpcBridgeSuccessPayload<T>,
  statusCode = HttpStatus.OK,
): IHttpResponse {
  return {
    statusCode,
    body: Buffer.from(JSON.stringify(payload)),
    errorCode: '',
    messageKey: payload.messageKey,
    headers: {},
    cookies: {},
  };
}

export function buildRedirectResponse(
  location: string,
  statusCode = HttpStatus.FOUND,
): IHttpResponse {
  return {
    statusCode,
    body: Buffer.alloc(0),
    errorCode: '',
    messageKey: '',
    headers: { location },
    cookies: {},
  };
}

export function mapExceptionToHttpResponse(exception: unknown): IHttpResponse {
  if (exception instanceof TranslatableException) {
    const status = exception.getStatus();
    const errorPayload: IGrpcBridgeErrorPayload = {
      args: exception.args,
      details: exception.details ?? null,
    };
    return {
      statusCode: status,
      body: Buffer.from(JSON.stringify(errorPayload)),
      errorCode: exception.errorCode,
      messageKey: exception.messageKey,
      headers: {},
      cookies: {},
    };
  }

  if (exception instanceof QueryFailedError) {
    return mapQueryFailedError(exception);
  }

  if (exception instanceof HttpException) {
    return mapHttpExceptionToResponse(exception);
  }

  if (exception instanceof Error && 'status' in exception) {
    const status = (exception as { status?: number }).status ?? HttpStatus.BAD_REQUEST;
    return {
      statusCode: status,
      body: Buffer.alloc(0),
      errorCode: mapHttpStatusToErrorCode(status),
      messageKey: 'error.generic.bad_request',
      headers: {},
      cookies: {},
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    body: Buffer.alloc(0),
    errorCode: ERROR_CODES.GENERIC_INTERNAL_SERVER_ERROR,
    messageKey: 'error.generic.internal_server_error',
    headers: {},
    cookies: {},
  };
}

export function attachGrpcErrorMetadata(metadata: Metadata, response: IHttpResponse): Metadata {
  if (response.errorCode) {
    metadata.set('error-code', response.errorCode);
  }
  if (response.messageKey) {
    metadata.set('message-key', response.messageKey);
  }
  metadata.set('http-status', String(response.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR));
  return metadata;
}

export function httpStatusToGrpcStatus(httpStatus: number): number {
  if (httpStatus >= 500) {
    return GrpcStatus.INTERNAL;
  }
  if (httpStatus === HttpStatus.UNAUTHORIZED) {
    return GrpcStatus.UNAUTHENTICATED;
  }
  if (httpStatus === HttpStatus.FORBIDDEN) {
    return GrpcStatus.PERMISSION_DENIED;
  }
  if (httpStatus === HttpStatus.NOT_FOUND) {
    return GrpcStatus.NOT_FOUND;
  }
  if (httpStatus === HttpStatus.CONFLICT) {
    return GrpcStatus.ALREADY_EXISTS;
  }
  return GrpcStatus.INVALID_ARGUMENT;
}

function mapHttpExceptionToResponse(exception: HttpException): IHttpResponse {
  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  let details: Record<string, unknown> | null = null;

  if (typeof response === 'object' && response !== null) {
    const typed = response as { message?: string | string[] };
    if (typed.message) {
      details = {
        message: Array.isArray(typed.message) ? typed.message.join('; ') : typed.message,
      };
    }
  } else if (typeof response === 'string') {
    details = { message: response };
  }

  return {
    statusCode,
    body: details ? Buffer.from(JSON.stringify({ details })) : Buffer.alloc(0),
    errorCode: mapHttpStatusToErrorCode(statusCode),
    messageKey: mapHttpStatusToMessageKey(statusCode),
    headers: {},
    cookies: {},
  };
}

function mapHttpStatusToMessageKey(status: number): string {
  const map: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'error.generic.bad_request',
    [HttpStatus.UNAUTHORIZED]: 'error.generic.unauthorized',
    [HttpStatus.FORBIDDEN]: 'error.generic.forbidden',
    [HttpStatus.NOT_FOUND]: 'error.generic.not_found',
    [HttpStatus.CONFLICT]: 'error.generic.conflict',
    [HttpStatus.UNPROCESSABLE_ENTITY]: 'error.generic.validation_failed',
    [HttpStatus.TOO_MANY_REQUESTS]: 'error.auth.rate_limited',
    [HttpStatus.BAD_GATEWAY]: 'error.generic.email_delivery_failed',
    [HttpStatus.INTERNAL_SERVER_ERROR]: 'error.generic.internal_server_error',
  };
  return map[status] ?? 'error.generic.internal_server_error';
}

function mapQueryFailedError(exception: QueryFailedError): IHttpResponse {
  const mapped = mapPostgresError(exception);
  return buildErrorResponse(mapped.status, mapped.errorCode, mapped.messageKey);
}

function buildErrorResponse(
  statusCode: number,
  errorCode: ErrorCode,
  messageKey: string,
): IHttpResponse {
  return {
    statusCode,
    body: Buffer.alloc(0),
    errorCode,
    messageKey,
    headers: {},
    cookies: {},
  };
}

function mapHttpStatusToErrorCode(status: number): ErrorCode {
  const map: Record<number, ErrorCode> = {
    [HttpStatus.BAD_REQUEST]: ERROR_CODES.GENERIC_BAD_REQUEST,
    [HttpStatus.UNAUTHORIZED]: ERROR_CODES.GENERIC_UNAUTHORIZED,
    [HttpStatus.FORBIDDEN]: ERROR_CODES.GENERIC_FORBIDDEN,
    [HttpStatus.NOT_FOUND]: ERROR_CODES.GENERIC_NOT_FOUND,
    [HttpStatus.CONFLICT]: ERROR_CODES.GENERIC_CONFLICT,
    [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.GENERIC_UNPROCESSABLE,
    [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.ADMIN_AUTH_RESEND_LIMIT,
    [HttpStatus.BAD_GATEWAY]: ERROR_CODES.EMAIL_DELIVERY_FAILED,
  };
  return map[status] ?? ERROR_CODES.GENERIC_INTERNAL_SERVER_ERROR;
}
