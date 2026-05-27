import { Metadata } from '@grpc/grpc-js';
import { NotificationsController } from '@modules/notifications/notifications.controller';
import { Injectable } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  createControllerBridgeHandlers,
  GrpcBridgeBase,
  IHttpResponse,
} from '@plys/libraries/common-nest/grpc';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

@Injectable()
export class NotificationsGrpcController extends GrpcBridgeBase {
  protected readonly handlers: Record<
    string,
    import('@plys/libraries/common-nest/grpc').GrpcBridgeHandler
  >;

  constructor(
    requestContext: RequestContextService,
    notificationsController: NotificationsController,
  ) {
    super(requestContext);
    this.handlers = createControllerBridgeHandlers(this, [
      {
        prefix: 'notifications',
        instance: notificationsController,
        methods: {
          listMine: (req): Promise<unknown[]> => Promise.resolve([this.parseJsonBody(req)]),
          unreadCount: (): Promise<unknown[]> => Promise.resolve([]),
          markRead: (req): Promise<unknown[]> => Promise.resolve([this.getPathParam(req, 'id')]),
          markAllRead: (): Promise<unknown[]> => Promise.resolve([]),
        },
      },
    ]);
  }

  @GrpcMethod('Notifications', 'Dispatch')
  public handleDispatch(
    request: Parameters<GrpcBridgeBase['dispatch']>[0],
    metadata?: Metadata,
  ): Promise<IHttpResponse> {
    return super.dispatch(request, metadata);
  }
}
