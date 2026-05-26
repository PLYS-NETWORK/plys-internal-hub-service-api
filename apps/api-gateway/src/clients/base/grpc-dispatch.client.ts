import { Metadata } from '@grpc/grpc-js';
import { OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import {
  dispatchGrpc,
  IGrpcDispatchClient,
  IHttpRequest,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';

export abstract class GrpcDispatchClientBase implements IGrpcDispatchClient, OnModuleInit {
  private grpcService!: IGrpcDispatchClient;

  protected abstract readonly grpcServiceName: string;

  protected constructor(protected readonly clientGrpc: ClientGrpc) {}

  public onModuleInit(): void {
    this.grpcService = this.clientGrpc.getService<IGrpcDispatchClient>(this.grpcServiceName);
  }

  public dispatch(request: IHttpRequest, metadata?: Metadata): Promise<IHttpResponse> {
    return this.grpcService.dispatch(request, metadata);
  }

  public async dispatchOperation(
    operation: string,
    options: {
      body?: unknown;
      pathParams?: Record<string, string>;
      queryParams?: Record<string, string>;
    } = {},
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    const request: IHttpRequest = {
      operation,
      body: options.body !== undefined ? Buffer.from(JSON.stringify(options.body)) : undefined,
      pathParams: options.pathParams,
      queryParams: options.queryParams,
    };
    return dispatchGrpc(this, request, metadata);
  }
}
