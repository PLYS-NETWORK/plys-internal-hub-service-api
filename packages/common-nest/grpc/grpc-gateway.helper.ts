import { Metadata } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { buildMetadataFromRequestContext } from '@plys/libraries/common-nest/grpc';
import {
  assertGrpcSuccess,
  dispatchGrpc,
  IGrpcDispatchClient,
  IHttpRequest,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { ITranslatedPayload } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class GrpcGatewayHelper {
  constructor(private readonly requestContext: RequestContextService) {}

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
      body: options.body ? Buffer.from(JSON.stringify(options.body)) : undefined,
      pathParams: options.pathParams,
      queryParams: options.queryParams,
    };
    const metadata = buildMetadataFromRequestContext(this.requestContext);
    const response = await dispatchGrpc(client, request, metadata);
    return assertGrpcSuccess<T>(response);
  }

  public async callRaw(
    client: IGrpcDispatchClient,
    request: IHttpRequest,
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    const ctxMetadata = metadata ?? buildMetadataFromRequestContext(this.requestContext);
    return dispatchGrpc(client, request, ctxMetadata);
  }
}
