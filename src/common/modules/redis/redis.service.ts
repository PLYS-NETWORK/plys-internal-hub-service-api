import { AppLogger } from '../logger';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

import { EnvironmentsService } from '../environments';
import { RequestContextService } from '../request-context';
import { IRedisService } from './interfaces';

@Injectable()
export class RedisService implements IRedisService, OnModuleInit, OnModuleDestroy {
  private readonly logger: AppLogger;
  private client!: Redis;

  constructor(
    private readonly env: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(RedisService.name, requestContext);
  }

  public onModuleInit(): void {
    this.client = new Redis({
      host: this.env.redisHost,
      port: this.env.redisPort,
      password: this.env.redisPassword,
      db: this.env.redisDb,
      keyPrefix: this.env.redisKeyPrefix,
      tls: this.env.redisTlsEnabled ? {} : undefined,
      lazyConnect: false,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    });

    this.client.on('connect', () => {
      this.logger.log(
        `[system] Redis — connected | host: ${this.env.redisHost}:${this.env.redisPort}`,
      );
    });

    this.client.on('ready', () => {
      this.logger.log(`[system] Redis — ready`);
    });

    this.client.on('error', (err: Error) => {
      this.logger.error(`[system] Redis — error | message: ${err.message}`);
    });

    this.client.on('close', () => {
      this.logger.warn(`[system] Redis — connection closed`);
    });

    this.client.on('reconnecting', () => {
      this.logger.warn(`[system] Redis — reconnecting`);
    });
  }

  public async onModuleDestroy(): Promise<void> {
    this.logger.log(`[system] Redis — shutting down`);
    await this.client.quit();
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.logger.log(`set — start | key: ${key}`);
    try {
      if (ttlSeconds !== undefined) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      this.logger.log(`set — complete | key: ${key}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`set — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async get(key: string): Promise<string | null> {
    this.logger.log(`get — start | key: ${key}`);
    try {
      const value = await this.client.get(key);
      this.logger.log(`get — complete | key: ${key} | hit: ${value !== null}`);
      return value;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`get — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async del(key: string): Promise<void> {
    this.logger.log(`del — start | key: ${key}`);
    try {
      await this.client.del(key);
      this.logger.log(`del — complete | key: ${key}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`del — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async exists(key: string): Promise<boolean> {
    this.logger.log(`exists — start | key: ${key}`);
    try {
      const count = await this.client.exists(key);
      this.logger.log(`exists — complete | key: ${key} | exists: ${count > 0}`);
      return count > 0;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`exists — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async expire(key: string, ttlSeconds: number): Promise<boolean> {
    this.logger.log(`expire — start | key: ${key} | ttl: ${ttlSeconds}s`);
    try {
      const result = await this.client.expire(key, ttlSeconds);
      this.logger.log(`expire — complete | key: ${key} | applied: ${result === 1}`);
      return result === 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`expire — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async ttl(key: string): Promise<number> {
    this.logger.log(`ttl — start | key: ${key}`);
    try {
      const remaining = await this.client.ttl(key);
      this.logger.log(`ttl — complete | key: ${key} | ttl: ${remaining}`);
      return remaining;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`ttl — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async incr(key: string): Promise<number> {
    this.logger.log(`incr — start | key: ${key}`);
    try {
      const value = await this.client.incr(key);
      this.logger.log(`incr — complete | key: ${key} | value: ${value}`);
      return value;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`incr — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async incrBy(key: string, increment: number): Promise<number> {
    this.logger.log(`incrBy — start | key: ${key} | increment: ${increment}`);
    try {
      const value = await this.client.incrby(key, increment);
      this.logger.log(`incrBy — complete | key: ${key} | value: ${value}`);
      return value;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`incrBy — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async sAdd(key: string, ...members: string[]): Promise<number> {
    this.logger.log(`sAdd — start | key: ${key} | count: ${members.length}`);
    try {
      const added = await this.client.sadd(key, ...members);
      this.logger.log(`sAdd — complete | key: ${key} | added: ${added}`);
      return added;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sAdd — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async sIsMember(key: string, member: string): Promise<boolean> {
    this.logger.log(`sIsMember — start | key: ${key}`);
    try {
      const result = await this.client.sismember(key, member);
      this.logger.log(`sIsMember — complete | key: ${key} | isMember: ${result === 1}`);
      return result === 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sIsMember — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async sRem(key: string, ...members: string[]): Promise<number> {
    this.logger.log(`sRem — start | key: ${key} | count: ${members.length}`);
    try {
      const removed = await this.client.srem(key, ...members);
      this.logger.log(`sRem — complete | key: ${key} | removed: ${removed}`);
      return removed;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`sRem — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async hSet(key: string, field: string, value: string): Promise<void> {
    this.logger.log(`hSet — start | key: ${key} | field: ${field}`);
    try {
      await this.client.hset(key, field, value);
      this.logger.log(`hSet — complete | key: ${key} | field: ${field}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`hSet — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async hGet(key: string, field: string): Promise<string | null> {
    this.logger.log(`hGet — start | key: ${key} | field: ${field}`);
    try {
      const value = await this.client.hget(key, field);
      this.logger.log(`hGet — complete | key: ${key} | field: ${field} | hit: ${value !== null}`);
      return value;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`hGet — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async hGetAll(key: string): Promise<Record<string, string>> {
    this.logger.log(`hGetAll — start | key: ${key}`);
    try {
      const value = await this.client.hgetall(key);
      this.logger.log(`hGetAll — complete | key: ${key}`);
      return value;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`hGetAll — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  public async hDel(key: string, ...fields: string[]): Promise<number> {
    this.logger.log(`hDel — start | key: ${key} | fields: ${fields.length}`);
    try {
      const removed = await this.client.hdel(key, ...fields);
      this.logger.log(`hDel — complete | key: ${key} | removed: ${removed}`);
      return removed;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`hDel — failed | key: ${key} | error: ${message}`);
      throw err;
    }
  }

  /**
   * Scans for keys matching `pattern`.
   * NOTE: ioredis does NOT prepend `keyPrefix` to pattern arguments — only to regular key args.
   * Pass fully-prefixed patterns (e.g., `'app:auth:blacklist:*'`).
   */
  public async keys(pattern: string): Promise<string[]> {
    this.logger.log(`keys — start | pattern: ${pattern}`);
    try {
      const result = await this.client.keys(pattern);
      this.logger.log(`keys — complete | pattern: ${pattern} | count: ${result.length}`);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`keys — failed | pattern: ${pattern} | error: ${message}`);
      throw err;
    }
  }

  public async ping(): Promise<string> {
    this.logger.log(`ping — start`);
    try {
      const pong = await this.client.ping();
      this.logger.log(`ping — complete | response: ${pong}`);
      return pong;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`ping — failed | error: ${message}`);
      throw err;
    }
  }
}
