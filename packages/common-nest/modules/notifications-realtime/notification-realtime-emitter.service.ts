import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import type Redis from 'ioredis';

import { EnvironmentsService } from '../environments';
import { createSocketIoRedisClient } from './create-socket-io-redis-clients.util';
import {
  NOTIFICATION_EVENT_NEW,
  NOTIFICATION_WS_NAMESPACE,
  notificationRoomForUser,
} from './notification-realtime.constants';

/**
 * Publishes live notification events into Socket.IO rooms via the Redis adapter
 * protocol. Used by platform-service after persisting a notification row.
 */
@Injectable()
export class NotificationRealtimeEmitterService implements OnModuleDestroy {
  private readonly redisClient: Redis;
  private readonly emitter: Emitter;

  constructor(private readonly env: EnvironmentsService) {
    this.redisClient = createSocketIoRedisClient(this.env);
    this.emitter = new Emitter(this.redisClient);
  }

  /** Targeted emit to `user:{userId}` on `/ws/notifications` — no global pub/sub fan-out. */
  public emitToUser(userId: string, payload: unknown): void {
    this.emitter
      .of(NOTIFICATION_WS_NAMESPACE)
      .to(notificationRoomForUser(userId))
      .emit(NOTIFICATION_EVENT_NEW, payload);
  }

  public async onModuleDestroy(): Promise<void> {
    await this.redisClient.quit();
  }
}
