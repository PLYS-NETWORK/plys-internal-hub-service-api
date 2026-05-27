import Redis, { type RedisOptions } from 'ioredis';

import type { EnvironmentsService } from '../environments';

/** Base ioredis options for Socket.IO adapter/emitter — no keyPrefix (adapter channels are global). */
function socketIoRedisOptions(env: EnvironmentsService): RedisOptions {
  return {
    host: env.redisHost,
    port: env.redisPort,
    password: env.redisPassword,
    db: env.redisDb,
    tls: env.redisTlsEnabled ? {} : undefined,
    lazyConnect: false,
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
  };
}

/** Dedicated pub/sub pair for `@socket.io/redis-adapter` on api-gateway. */
export function createSocketIoRedisPubSubClients(env: EnvironmentsService): {
  pubClient: Redis;
  subClient: Redis;
} {
  const options = socketIoRedisOptions(env);
  return {
    pubClient: new Redis(options),
    subClient: new Redis(options),
  };
}

/** Single client for `@socket.io/redis-emitter` on platform-service. */
export function createSocketIoRedisClient(env: EnvironmentsService): Redis {
  return new Redis(socketIoRedisOptions(env));
}
