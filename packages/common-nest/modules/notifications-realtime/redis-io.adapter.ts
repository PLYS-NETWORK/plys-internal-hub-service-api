import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';

import { EnvironmentsService } from '../environments';
import { createSocketIoRedisPubSubClients } from './create-socket-io-redis-clients.util';

/**
 * Attaches `@socket.io/redis-adapter` so Socket.IO rooms sync across api-gateway
 * replicas. Must be registered in main.ts before the app listens.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    private readonly env: EnvironmentsService,
  ) {
    super(app);
  }

  public async connectToRedis(): Promise<void> {
    const { pubClient, subClient } = createSocketIoRedisPubSubClients(this.env);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  public createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
