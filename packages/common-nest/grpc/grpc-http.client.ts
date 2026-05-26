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

export async function dispatchGrpc(
  client: IGrpcDispatchClient,
  request: IHttpRequest,
  metadata?: Metadata,
): Promise<IHttpResponse> {
  return firstValueFrom(client.dispatch(request, metadata));
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
