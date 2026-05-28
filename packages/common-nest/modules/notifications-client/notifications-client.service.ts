import { Injectable, Logger } from '@nestjs/common';
import { NotificationEventName } from '@plys/libraries/common-nest/events';
import { buildMetadataFromRequestContext } from '@plys/libraries/common-nest/grpc';
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
  private readonly logger = new Logger(NotificationsClientService.name);

  constructor(
    private readonly grpc: NotificationsGrpcClient,
    private readonly requestContext: RequestContextService,
  ) {}

  /** Fire-and-forget domain event — mirrors former EventEmitter2.emit usage. */
  public emit(event: NotificationEventName, payload: unknown): void {
    const metadata = buildMetadataFromRequestContext(this.requestContext);
    void this.grpc
      .dispatchOperation('notificationInternal.emit', { body: { event, payload } }, metadata)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`emit — failed | event: ${event} | error: ${msg}`);
      });
  }

  /** Fire-and-forget direct dispatch — mirrors NotificationDispatcherService.dispatch. */
  public dispatch(input: INotificationsDispatchInput): void {
    const metadata = buildMetadataFromRequestContext(this.requestContext);
    void this.grpc
      .dispatchOperation('notificationInternal.dispatch', { body: input }, metadata)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`dispatch — failed | type: ${input.type} | error: ${msg}`);
      });
  }
}
