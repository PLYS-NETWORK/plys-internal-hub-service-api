import { HttpCode, HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEventName } from '@plys/libraries/common-nest/events';

import { NotificationType } from '../enums/notification-type.enum';
import { IDispatchInput } from '../interfaces/notification-dispatcher-service.interface';
import { NotificationDispatcherService } from '../services/notification-dispatcher.service';
/** Internal-only bridge invoked via gRPC from domain services. */
@Injectable()
export class NotificationInternalController {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}
  @HttpCode(HttpStatus.NO_CONTENT)
  public async emit(body: { event: NotificationEventName; payload: unknown }): Promise<void> {
    this.eventEmitter.emit(body.event, body.payload);
  }
  @HttpCode(HttpStatus.OK)
  public async dispatch(body: IDispatchInput<NotificationType>): Promise<{ id: string | null }> {
    const id = await this.dispatcher.dispatch(body);
    return { id };
  }
}
