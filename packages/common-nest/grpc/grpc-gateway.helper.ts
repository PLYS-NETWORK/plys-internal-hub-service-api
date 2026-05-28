import { Metadata } from '@grpc/grpc-js';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { instanceToPlain } from 'class-transformer';

import {
  buildUpstreamBridgeErrorMeta,
  buildUpstreamTransportErrorMeta,
  resolveGrpcOperation,
  writeServiceLog,
} from './grpc-call-log.util';
import {
  assertGrpcSuccess,
  dispatchGrpc,
  IGrpcDispatchClient,
  isGrpcErrorResponse,
} from './grpc-http.client';
import { IGrpcBridgeSuccessPayload, IHttpRequest, IHttpResponse } from './grpc-http.types';
import { buildMetadataFromRequestContext } from './grpc-metadata.util';

@Injectable()
export class GrpcGatewayHelper {
  private readonly logger: AppLogger;

  constructor(private readonly requestContext: RequestContextService) {
    this.logger = new AppLogger(GrpcGatewayHelper.name, requestContext);
  }

  public async call<T>(
    client: IGrpcDispatchClient,
    operation: string,
    options: {
      body?: unknown;
      pathParams?: Record<string, string>;
      queryParams?: Record<string, string>;
    } = {},
  ): Promise<ITranslatedPayload<T>> {
    const request: IHttpRequest = {
      operation,
      body: options.body
        ? Buffer.from(JSON.stringify(instanceToPlain(options.body, { exposeUnsetFields: false })))
        : undefined,
      pathParams: options.pathParams,
      queryParams: options.queryParams,
    };
    const metadata = buildMetadataFromRequestContext(this.requestContext);
    const response = await this.dispatchWithLogging(client, operation, () =>
      dispatchGrpc(client, request, metadata),
    );
    return this.assertSuccess<T>(client, operation, response);
  }

  public async callRaw(
    client: IGrpcDispatchClient,
    request: IHttpRequest,
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    const operation = resolveGrpcOperation(request);
    const ctxMetadata = metadata ?? buildMetadataFromRequestContext(this.requestContext);
    return this.dispatchWithLogging(client, operation, () =>
      dispatchGrpc(client, request, ctxMetadata),
    );
  }

  public assertSuccess<T>(
    client: IGrpcDispatchClient,
    operation: string,
    response: IHttpResponse,
  ): IGrpcBridgeSuccessPayload<T> {
    if (isGrpcErrorResponse(response)) {
      this.logUpstreamBridgeError(client, operation, response);
    }
    return assertGrpcSuccess<T>(response);
  }

  private async dispatchWithLogging(
    client: IGrpcDispatchClient,
    operation: string,
    dispatch: () => Promise<IHttpResponse>,
  ): Promise<IHttpResponse> {
    try {
      return await dispatch();
    } catch (err: unknown) {
      this.logUpstreamTransportError(client, operation, err);
      throw err;
    }
  }

  private logUpstreamBridgeError(
    client: IGrpcDispatchClient,
    operation: string,
    response: IHttpResponse,
  ): void {
    const meta = buildUpstreamBridgeErrorMeta(client, operation, response);
    const status = (meta.upstream_status as number) ?? HttpStatus.BAD_REQUEST;
    const message = `upstream gRPC call failed | service: ${meta.upstream_service} | operation: ${operation}`;
    writeServiceLog(this.logger, message, status, meta);
  }

  private logUpstreamTransportError(
    client: IGrpcDispatchClient,
    operation: string,
    err: unknown,
  ): void {
    const meta = buildUpstreamTransportErrorMeta(client, operation, err);
    writeServiceLog(
      this.logger,
      `upstream gRPC transport failed | service: ${meta.upstream_service} | operation: ${operation}`,
      HttpStatus.BAD_GATEWAY,
      meta,
      err instanceof Error ? err.stack : undefined,
    );
  }
}
