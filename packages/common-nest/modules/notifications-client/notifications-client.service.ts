import { HttpStatus, Injectable } from '@nestjs/common';
import { NotificationEventName } from '@plys/libraries/common-nest/events';
import {
  buildMetadataFromRequestContext,
  buildUpstreamBridgeErrorMeta,
  buildUpstreamTransportErrorMeta,
  isGrpcErrorResponse,
  writeServiceLog,
} from '@plys/libraries/common-nest/grpc';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

import { INotificationsDispatchInput } from './notifications-client.types';
import { NotificationsGrpcClient } from './notifications-grpc.client';

/**
 * Cross-service notifications bridge. Domain services call this instead of
 * in-process EventEmitter2 or NotificationDispatcherService so events reach
 * notifications-service over gRPC.
 */
@Injectable()
export class NotificationsClientService {
  private readonly logger: AppLogger;

  constructor(
    private readonly grpc: NotificationsGrpcClient,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(NotificationsClientService.name, requestContext);
  }

  /** Fire-and-forget domain event — mirrors former EventEmitter2.emit usage. */
  public emit(event: NotificationEventName, payload: unknown): void {
    void this.dispatchOperation('notificationInternal.emit', { event, payload });
  }

  /** Fire-and-forget direct dispatch — mirrors NotificationDispatcherService.dispatch. */
  public dispatch(input: INotificationsDispatchInput): void {
    void this.dispatchOperation('notificationInternal.dispatch', input);
  }

  private dispatchOperation(operation: string, body: unknown): void {
    const metadata = buildMetadataFromRequestContext(this.requestContext);
    void this.grpc
      .dispatchOperation(operation, { body }, metadata)
      .then((response) => {
        if (!isGrpcErrorResponse(response)) {
          return;
        }
        const meta = buildUpstreamBridgeErrorMeta(this.grpc, operation, response);
        writeServiceLog(
          this.logger,
          `upstream gRPC call failed | service: ${meta.upstream_service} | operation: ${operation}`,
          (meta.upstream_status as number) ?? HttpStatus.BAD_REQUEST,
          meta,
        );
      })
      .catch((err: unknown) => {
        const meta = buildUpstreamTransportErrorMeta(this.grpc, operation, err);
        writeServiceLog(
          this.logger,
          `upstream gRPC transport failed | service: ${meta.upstream_service} | operation: ${operation}`,
          HttpStatus.BAD_GATEWAY,
          meta,
          err instanceof Error ? err.stack : undefined,
        );
      });
  }
}
