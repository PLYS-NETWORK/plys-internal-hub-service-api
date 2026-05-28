import { HttpStatus } from '@nestjs/common';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { QueryFailedError } from 'typeorm';

import { IGrpcDispatchClient } from './grpc-http.client';
import { IGrpcBridgeErrorPayload, IHttpRequest, IHttpResponse } from './grpc-http.types';

interface IGrpcDispatchClientWithBridge extends IGrpcDispatchClient {
  bridgeServiceName?: string;
}

const CLIENT_CLASS_TO_SERVICE: Array<[RegExp, string]> = [
  [/^Identity/, 'identity-service'],
  [/^Business/, 'business-service'],
  [/^Consultant|^SkillExams|^Explore/, 'consultant-service'],
  [/^Admin/, 'internal-admin-service'],
  [/^TaskReview/, 'internal-task-reviewer-service'],
  [/^Payments|^Billing|^Webhooks/, 'finance-service'],
  [/^Notifications/, 'notifications-service'],
  [/^Files|^Skills|^PlatformHealth/, 'platform-service'],
  [/^AiProvider|^ProjectAi|^ChatSessions/, 'ai-provider-service'],
];

export function resolveRuntimeServiceName(): string {
  return process.env.SERVICE?.trim() || 'unknown-service';
}

export function resolveUpstreamServiceName(client: IGrpcDispatchClient): string {
  const clientClass = client.constructor?.name ?? 'UnknownClient';
  for (const [pattern, service] of CLIENT_CLASS_TO_SERVICE) {
    if (pattern.test(clientClass)) {
      return service;
    }
  }
  return clientClass.replace(/Client$/, '');
}

export function resolveUpstreamClientClass(client: IGrpcDispatchClient): string {
  return client.constructor?.name ?? 'UnknownClient';
}

export function resolveUpstreamBridgeService(client: IGrpcDispatchClient): string | undefined {
  const bridgeServiceName = (client as IGrpcDispatchClientWithBridge).bridgeServiceName;
  return typeof bridgeServiceName === 'string' ? bridgeServiceName : undefined;
}

export function resolveGrpcOperation(request: IHttpRequest, fallback = '(unknown)'): string {
  return request.operation?.trim() || fallback;
}

export function parseBridgeErrorBody(response: IHttpResponse): IGrpcBridgeErrorPayload | null {
  const raw = response.body;
  if (!raw || raw.length === 0) {
    return null;
  }
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : Buffer.from(raw).toString('utf8');
  try {
    return JSON.parse(text) as IGrpcBridgeErrorPayload;
  } catch {
    return null;
  }
}

export function formatGrpcTransportError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error) && (typeof err !== 'object' || err === null)) {
    return { error_message: String(err) };
  }
  const candidate = err as { code?: number; message?: string; details?: string };
  return {
    grpc_code: candidate.code,
    error_message: candidate.message ?? (err instanceof Error ? err.message : String(err)),
    grpc_details: candidate.details,
  };
}

export function buildExceptionLogMeta(exception: unknown): Record<string, unknown> {
  if (exception instanceof TranslatableException) {
    return {
      error_type: exception.constructor.name,
      error_code: exception.errorCode,
      error_key: exception.messageKey,
      error_details: exception.details ?? undefined,
      error_args: exception.args ?? undefined,
      error_message: exception.message,
    };
  }
  if (exception instanceof QueryFailedError) {
    const driverError = exception.driverError as { code?: string; detail?: string } | undefined;
    return {
      error_type: exception.constructor.name,
      error_message: exception.message,
      db_code: driverError?.code,
      db_detail: driverError?.detail,
    };
  }
  if (exception instanceof Error) {
    return {
      error_type: exception.name,
      error_message: exception.message,
    };
  }
  return {
    error_type: 'unknown',
    error_message: String(exception),
  };
}

export function buildUpstreamBridgeErrorMeta(
  client: IGrpcDispatchClient,
  operation: string,
  response: IHttpResponse,
): Record<string, unknown> {
  const errorBody = parseBridgeErrorBody(response);
  return {
    caller_service: resolveRuntimeServiceName(),
    upstream_service: resolveUpstreamServiceName(client),
    upstream_client: resolveUpstreamClientClass(client),
    upstream_grpc_service: resolveUpstreamBridgeService(client),
    grpc_operation: operation,
    upstream_status: response.statusCode ?? HttpStatus.BAD_REQUEST,
    error_code: response.errorCode || undefined,
    error_key: response.messageKey || undefined,
    error_details: errorBody?.details ?? undefined,
    error_args: errorBody?.args ?? undefined,
  };
}

export function buildUpstreamTransportErrorMeta(
  client: IGrpcDispatchClient,
  operation: string,
  err: unknown,
): Record<string, unknown> {
  return {
    caller_service: resolveRuntimeServiceName(),
    upstream_service: resolveUpstreamServiceName(client),
    upstream_client: resolveUpstreamClientClass(client),
    upstream_grpc_service: resolveUpstreamBridgeService(client),
    grpc_operation: operation,
    ...formatGrpcTransportError(err),
  };
}

export function buildInboundBridgeErrorMeta(
  bridgeController: string,
  operation: string,
  response: IHttpResponse,
  exception?: unknown,
  phase?: string,
): Record<string, unknown> {
  const errorBody = parseBridgeErrorBody(response);
  const exceptionMeta = exception ? buildExceptionLogMeta(exception) : {};
  return {
    service: resolveRuntimeServiceName(),
    bridge_controller: bridgeController,
    grpc_operation: operation,
    handler_phase: phase,
    response_status: response.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR,
    error_code: response.errorCode || exceptionMeta.error_code || undefined,
    error_key: response.messageKey || exceptionMeta.error_key || undefined,
    error_details:
      errorBody?.details ??
      (exception instanceof TranslatableException ? (exception.details ?? undefined) : undefined),
    error_args:
      errorBody?.args ??
      (exception instanceof TranslatableException ? (exception.args ?? undefined) : undefined),
    error_type: exceptionMeta.error_type,
    error_message: exceptionMeta.error_message,
    db_code: exceptionMeta.db_code,
    db_detail: exceptionMeta.db_detail,
  };
}

export function writeServiceLog(
  logger: AppLogger,
  message: string,
  status: number,
  meta: Record<string, unknown>,
  stack?: string,
): void {
  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    logger.error(message, stack, meta);
    return;
  }
  logger.warn(message, meta);
}
