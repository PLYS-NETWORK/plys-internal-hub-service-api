import { Metadata, status as GrpcStatus } from '@grpc/grpc-js';
import { HttpStatus } from '@nestjs/common';
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
  };
  return map[status] ?? ERROR_CODES.GENERIC_INTERNAL_SERVER_ERROR;
}
