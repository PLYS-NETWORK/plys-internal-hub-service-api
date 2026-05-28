import { HttpStatus, Injectable } from '@nestjs/common';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';

import { ERROR_CODES } from '../../../errors/error-codes';
import { IAdminOtpAttemptTracker } from '../interfaces/admin-otp-attempt-tracker.interface';

// Max wrong OTP attempts before the email is locked.
const MAX_FAILURES = 5;
// Lock TTL in seconds (1 hour).
const LOCK_TTL_SECONDS = 60 * 60;

/**
 * Per-email wrong-OTP failure counter with rolling-window lockout, backed by Redis.
 *
 * Why per-email (not per-IP): an attacker rotating IPs cannot defeat this counter.
 * Five consecutive wrong guesses locks the email for 1 hour regardless of source.
 */
@Injectable()
export class AdminOtpAttemptTracker implements IAdminOtpAttemptTracker {
  private readonly logger: AppLogger;
  private static readonly KEY_PREFIX = 'admin:otp:fail:';

  constructor(
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(AdminOtpAttemptTracker.name, requestContext);
  }

  private get rid(): string {
    return this.requestContext.requestId;
  }

  /** @inheritdoc */
  public async assertNotLocked(email: string): Promise<void> {
    const key = AdminOtpAttemptTracker.KEY_PREFIX + email.toLowerCase();
    const current = await this.redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= MAX_FAILURES) {
      this.logger.warn(`[${this.rid}] assertNotLocked — locked | email: ${email}, count: ${count}`);
      throw new TranslatableException({
        messageKey: 'error.admin.otp_locked',
        errorCode: ERROR_CODES.ADMIN_AUTH_OTP_LOCKED,
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    }
  }

  /** @inheritdoc */
  public async recordFailure(email: string): Promise<number> {
    const key = AdminOtpAttemptTracker.KEY_PREFIX + email.toLowerCase();
    const count = await this.redis.incr(key);

    if (count === 1) {
      // First failure in window — set TTL so the lock rolls automatically.
      await this.redis.expire(key, LOCK_TTL_SECONDS);
    }

    this.logger.warn(`[${this.rid}] recordFailure — count: ${count} | email: ${email}`);
    return count;
  }

  /** @inheritdoc */
  public async reset(email: string): Promise<void> {
    const key = AdminOtpAttemptTracker.KEY_PREFIX + email.toLowerCase();
    await this.redis.del(key);
  }
}
