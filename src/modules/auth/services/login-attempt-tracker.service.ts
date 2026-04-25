import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { HttpStatus, Injectable } from '@nestjs/common';

import { ILoginAttemptTracker } from '../interfaces/login-attempt-tracker.interface';

/**
 * Per-user failed-login counter with rolling-window lockout, backed by Redis.
 *
 * Why per-user (not per-IP): an attacker rotating IPs (proxies, residential
 * pools) can defeat IP-based rate limits. Per-user counters guarantee that
 * brute-force against a specific account always escalates regardless of
 * source IP. A per-IP rate limit is still applied separately at the
 * controller via @nestjs/throttler.
 */
@Injectable()
export class LoginAttemptTracker implements ILoginAttemptTracker {
  private readonly logger: AppLogger;
  private static readonly KEY_PREFIX = 'auth:fail:';

  constructor(
    private readonly redis: RedisService,
    private readonly env: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(LoginAttemptTracker.name, requestContext);
  }

  /** @inheritdoc */
  public async assertNotLocked(userId: string): Promise<void> {
    const key = LoginAttemptTracker.KEY_PREFIX + userId;
    const current = await this.redis.get(key);
    const count = current ? parseInt(current, 10) : 0;
    if (count >= this.env.loginLockoutThreshold) {
      this.logger.warn(`assertNotLocked — locked | userId: ${userId}, count: ${count}`);
      throw new TranslatableException({
        messageKey: 'error.auth.account_locked',
        errorCode: ERROR_CODES.AUTH_ACCOUNT_LOCKED,
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    }
  }

  /** @inheritdoc */
  public async recordFailure(userId: string): Promise<number> {
    const key = LoginAttemptTracker.KEY_PREFIX + userId;
    const count = await this.redis.incr(key);
    if (count === 1) {
      // First failure in window — set TTL so the counter rolls.
      await this.redis.expire(key, this.env.loginLockoutWindowMin * 60);
    }
    this.logger.warn(`recordFailure — count: ${count} | userId: ${userId}`);
    return count;
  }

  /** @inheritdoc */
  public async reset(userId: string): Promise<void> {
    const key = LoginAttemptTracker.KEY_PREFIX + userId;
    await this.redis.del(key);
  }
}
