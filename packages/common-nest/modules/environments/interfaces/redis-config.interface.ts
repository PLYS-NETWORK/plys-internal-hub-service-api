export interface IRedisConfig {
  /** Hostname or IP of the Redis server. */
  readonly redisHost: string;

  /** TCP port the Redis server listens on (default 6379). */
  readonly redisPort: number;

  /**
   * Optional AUTH password. `undefined` means no authentication is sent.
   * An empty string in `.env` is coerced to `undefined` so ioredis does not
   * issue a spurious AUTH command against a password-less server.
   */
  readonly redisPassword: string | undefined;

  /**
   * Logical database index to select on connect (Redis supports 0–15 by
   * default). Use `0` unless the deployment shares one Redis instance across
   * multiple environments and isolation between them is needed.
   */
  readonly redisDb: number;

  /**
   * String prepended to every key before it is sent to Redis.
   * Provides namespace isolation when multiple apps share one instance.
   * Example: `'app:'` → key `auth:blacklist:<jti>` is stored as `app:auth:blacklist:<jti>`.
   */
  readonly redisKeyPrefix: string;

  /** When `true`, wraps the TCP connection in TLS — required for managed Redis services (Upstash, Redis Cloud, etc.) over public networks. */
  readonly redisTlsEnabled: boolean;
}
