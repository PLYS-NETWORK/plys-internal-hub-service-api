import { Metadata } from '@grpc/grpc-js';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

import { mapExceptionToHttpResponse } from './grpc-error.util';
import { GrpcBridgeHandler, IHttpRequest, IHttpResponse } from './grpc-http.types';
import {
  applyMetadataToRequestContext,
  readRequestContextFromMetadata,
} from './grpc-metadata.util';

export abstract class GrpcBridgeBase {
  protected abstract readonly handlers: Record<string, GrpcBridgeHandler>;

  protected constructor(protected readonly requestContext: RequestContextService) {}

  public async dispatch(request: IHttpRequest, metadata?: Metadata): Promise<IHttpResponse> {
    const operation = request.operation ?? '';
    const handler = this.handlers[operation];

    if (!handler) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        body: Buffer.alloc(0),
        errorCode: ERROR_CODES.GENERIC_NOT_FOUND,
        messageKey: 'error.generic.not_found',
        headers: {},
        cookies: {},
      };
    }

    const context = metadata ? readRequestContextFromMetadata(metadata) : undefined;

    try {
      if (context) {
        return await this.requestContext.run(context, async () => {
          if (metadata) {
            applyMetadataToRequestContext(this.requestContext, metadata);
          }
          return handler(request);
        });
      }
      return await handler(request);
    } catch (exception) {
      return mapExceptionToHttpResponse(exception);
    }
  }

  protected parseJsonBody<T>(request: IHttpRequest): T {
    const raw = request.body;
    if (!raw || raw.length === 0) {
      return {} as T;
    }
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : Buffer.from(raw).toString('utf8');
    return JSON.parse(text) as T;
  }

  protected getPathParam(request: IHttpRequest, key: string): string {
    return request.pathParams?.[key] ?? '';
  }

  protected getQueryParam(request: IHttpRequest, key: string): string | undefined {
    return request.queryParams?.[key];
  }
}
