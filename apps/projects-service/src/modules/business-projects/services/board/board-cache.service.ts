import { Injectable } from '@nestjs/common';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RedisService } from '@plys/libraries/common-nest/modules/redis';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { createHash } from 'crypto';

const KEY_NAMESPACE = 'board:tasks';
export const BOARD_TASKS_CACHE_TTL_SECONDS = 60;

/**
 * Hub for the board task list cache.
 *
 * The list query has many filter / sort permutations and is hit often, so it
 * is cached per-(project, user, timezone, filter-set) for {@link BOARD_TASKS_CACHE_TTL_SECONDS}.
 * Mutations elsewhere (status changes, attachment uploads, status transitions)
 * call {@link invalidateProject} to wipe every variant for the project.
 *
 * Redis prefix handling: `redis.keys()` requires a fully-prefixed pattern,
 * while `redis.set/get/del()` auto-prepend the prefix. We construct the
 * prefixed pattern for `keys()` then strip the prefix before passing each
 * matched key back to `del()`.
 */
@Injectable()
export class BoardCacheService {
  private readonly logger: AppLogger;
  private readonly keyPrefix: string;

  constructor(
    private readonly redis: RedisService,
    env: EnvironmentsService,
    requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(BoardCacheService.name, requestContext);
    this.keyPrefix = env.redisKeyPrefix;
  }

  /**
   * Build a cache key that varies on every input that can change the
   * response: project, caller, timezone (formatting), and filter/sort.
   */
  public buildKey(
    projectId: string,
    userId: string,
    timezone: string,
    filterDigestInput: unknown,
  ): string {
    const filterHash = createHash('sha1')
      .update(JSON.stringify(filterDigestInput ?? {}))
      .digest('hex')
      .slice(0, 12);
    return `${KEY_NAMESPACE}:${projectId}:${userId}:${timezone}:${filterHash}`;
  }

  public async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`get — corrupt cache entry, evicting | key: ${key}`);
      await this.redis.del(key);
      return null;
    }
  }

  public async set<T>(key: string, value: T): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), BOARD_TASKS_CACHE_TTL_SECONDS);
  }

  public async invalidateKey(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Wipes every cached list variant for a project. Called after any task /
   * attachment / status mutation.
   */
  public async invalidateProject(projectId: string): Promise<void> {
    const namespacePattern = `${KEY_NAMESPACE}:${projectId}:*`;
    const fullyQualifiedPattern = `${this.keyPrefix}${namespacePattern}`;
    const matched = await this.redis.keys(fullyQualifiedPattern);
    if (matched.length === 0) return;

    // Strip the prefix so RedisService.del re-prepends it without doubling.
    const unprefixed = matched.map((k) =>
      k.startsWith(this.keyPrefix) ? k.slice(this.keyPrefix.length) : k,
    );
    await Promise.all(unprefixed.map((k) => this.redis.del(k)));
    this.logger.log(
      `invalidateProject — evicted | projectId: ${projectId}, count: ${matched.length}`,
    );
  }
}
