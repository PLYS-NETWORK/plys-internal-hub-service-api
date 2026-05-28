import { Metadata } from '@grpc/grpc-js';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import {
  dispatchGrpc,
  IGrpcDispatchClient,
  IHttpRequest,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { Observable } from 'rxjs';

export const NOTIFICATIONS_GRPC = 'NOTIFICATIONS_GRPC';

@Injectable()
export class NotificationsGrpcClient implements IGrpcDispatchClient, OnModuleInit {
  private grpcService!: IGrpcDispatchClient;

  public get bridgeServiceName(): string {
    return 'Notifications';
  }

  constructor(@Inject(NOTIFICATIONS_GRPC) private readonly clientGrpc: ClientGrpc) {}

  public onModuleInit(): void {
    this.grpcService = this.clientGrpc.getService<IGrpcDispatchClient>('Notifications');
  }

  public dispatch(request: IHttpRequest, metadata?: Metadata): Observable<IHttpResponse> {
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
