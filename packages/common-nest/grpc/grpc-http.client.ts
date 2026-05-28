import { Metadata } from '@grpc/grpc-js';
import { HttpStatus } from '@nestjs/common';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { firstValueFrom, Observable } from 'rxjs';

import {
  IGrpcBridgeErrorPayload,
  IGrpcBridgeSuccessPayload,
  IHttpRequest,
  IHttpResponse,
} from './grpc-http.types';

export interface IGrpcDispatchClient {
  dispatch(request: IHttpRequest, metadata?: Metadata): Observable<IHttpResponse>;
}

const GRPC_UNAVAILABLE = 14;
const DEFAULT_DISPATCH_RETRIES = 3;
const RETRY_BASE_MS = 400;

function isGrpcTransientError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const candidate = err as { code?: number; message?: string; details?: string };
  if (candidate.code === GRPC_UNAVAILABLE) {
    return true;
  }
  const text = `${candidate.message ?? ''} ${candidate.details ?? ''}`;
  return text.includes('ECONNREFUSED') || text.includes('UNAVAILABLE');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dispatchGrpc(
  client: IGrpcDispatchClient,
  request: IHttpRequest,
  metadata?: Metadata,
): Promise<IHttpResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= DEFAULT_DISPATCH_RETRIES; attempt += 1) {
    try {
      return await firstValueFrom(client.dispatch(request, metadata));
    } catch (err: unknown) {
      lastError = err;
      if (attempt >= DEFAULT_DISPATCH_RETRIES || !isGrpcTransientError(err)) {
        throw err;
      }
      await sleep(RETRY_BASE_MS * attempt);
    }
  }
  throw lastError;
}

export function isGrpcErrorResponse(response: IHttpResponse): boolean {
  const status = response.statusCode ?? HttpStatus.OK;
  return status >= HttpStatus.BAD_REQUEST || Boolean(response.errorCode);
}

export function parseGrpcSuccessPayload<T>(response: IHttpResponse): IGrpcBridgeSuccessPayload<T> {
  const raw = response.body;
  if (!raw || raw.length === 0) {
    return {
      messageKey: response.messageKey ?? 'success.ok',
      data: null as T,
    };
  }
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : Buffer.from(raw).toString('utf8');
  return JSON.parse(text) as IGrpcBridgeSuccessPayload<T>;
}

export function assertGrpcSuccess<T>(response: IHttpResponse): IGrpcBridgeSuccessPayload<T> {
  if (isGrpcErrorResponse(response)) {
    const raw = response.body;
    let details: Record<string, unknown> | undefined;
    let args: Record<string, string | number> | undefined;
    if (raw && raw.length > 0) {
      const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : Buffer.from(raw).toString('utf8');
      const parsed = JSON.parse(text) as IGrpcBridgeErrorPayload;
      details = parsed.details ?? undefined;
      args = parsed.args;
    }
    throw new TranslatableException({
      messageKey: response.messageKey ?? 'error.generic.bad_request',
      errorCode: (response.errorCode ?? 'GENERIC_BAD_REQUEST') as never,
      status: response.statusCode ?? HttpStatus.BAD_REQUEST,
      args,
      details,
    });
  }
  return parseGrpcSuccessPayload<T>(response);
}
