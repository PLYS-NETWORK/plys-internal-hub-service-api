import { Metadata } from '@grpc/grpc-js';
import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ClassConstructor } from 'class-transformer';

import {
  buildInboundBridgeErrorMeta,
  resolveRuntimeServiceName,
  writeServiceLog,
} from './grpc-call-log.util';
import { validateRequestDto } from './grpc-dto-validation.util';
import { mapExceptionToHttpResponse } from './grpc-error.util';
import { GrpcBridgeHandler, IHttpRequest, IHttpResponse } from './grpc-http.types';
import {
  applyMetadataToRequestContext,
  readRequestContextFromMetadata,
} from './grpc-metadata.util';
import { assertGrpcServiceAuthorized } from './grpc-service-auth.util';

export abstract class GrpcBridgeBase {
  protected abstract readonly handlers: Record<string, GrpcBridgeHandler>;

  private readonly logger: AppLogger;

  protected constructor(protected readonly requestContext: RequestContextService) {
    this.logger = new AppLogger(this.constructor.name, requestContext);
  }

  public async dispatch(request: IHttpRequest, metadata?: Metadata): Promise<IHttpResponse> {
    const operation = request.operation ?? '';
    const handler = this.handlers[operation];

    if (!handler) {
      const response: IHttpResponse = {
        statusCode: HttpStatus.NOT_FOUND,
        body: Buffer.alloc(0),
        errorCode: ERROR_CODES.GENERIC_NOT_FOUND,
        messageKey: 'error.generic.not_found',
        headers: {},
        cookies: {},
      };
      writeServiceLog(
        this.logger,
        `gRPC operation not found | service: ${resolveRuntimeServiceName()} | operation: ${operation}`,
        HttpStatus.NOT_FOUND,
        buildInboundBridgeErrorMeta(
          this.constructor.name,
          operation,
          response,
          undefined,
          'routing',
        ),
      );
      return response;
    }

    try {
      assertGrpcServiceAuthorized(metadata);
    } catch (exception) {
      const response = mapExceptionToHttpResponse(exception);
      this.logBridgeFailure(operation, exception, response, 'auth');
      return response;
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
      const response = mapExceptionToHttpResponse(exception);
      this.logBridgeFailure(operation, exception, response, 'handler');
      return response;
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

  protected async parseAndValidateBody<T extends object>(
    request: IHttpRequest,
    dtoClass: ClassConstructor<T>,
  ): Promise<T> {
    const plain = this.parseJsonBody<Record<string, unknown>>(request);
    return validateRequestDto(plain, dtoClass);
  }

  protected getPathParam(request: IHttpRequest, key: string): string {
    return request.pathParams?.[key] ?? '';
  }

  protected getQueryParam(request: IHttpRequest, key: string): string | undefined {
    return request.queryParams?.[key];
  }

  private logBridgeFailure(
    operation: string,
    exception: unknown,
    response: IHttpResponse,
    phase: 'auth' | 'handler',
  ): void {
    const status = response.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const meta = buildInboundBridgeErrorMeta(
      this.constructor.name,
      operation,
      response,
      exception,
      phase,
    );
    writeServiceLog(
      this.logger,
      `gRPC handler failed | service: ${resolveRuntimeServiceName()} | operation: ${operation} | phase: ${phase}`,
      status,
      meta,
      exception instanceof Error ? exception.stack : undefined,
    );
  }
}
