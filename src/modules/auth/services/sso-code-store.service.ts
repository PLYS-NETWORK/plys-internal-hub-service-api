import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

import { AuthResponseDto } from '../dto/responses/auth-response.dto';
import { ISsoCodeStore } from '../interfaces/sso-code-store.interface';

/**
 * Single-use code → AuthResponseDto map backed by Redis.
 *
 * Why: the OAuth callback used to redirect with `?access_token=...` in the
 * URL — a token-leak via proxy logs / browser history. Instead we redirect
 * with a short-lived random `code` that the frontend POSTs to
 * `/auth/sso/exchange` once. The code is consumed atomically (`GETDEL`) so
 * a second exchange always fails.
 */
@Injectable()
export class SsoCodeStore implements ISsoCodeStore {
  private readonly logger: AppLogger;
  private static readonly KEY_PREFIX = 'sso:exchange:';

  constructor(
    private readonly redis: RedisService,
    private readonly env: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(SsoCodeStore.name, requestContext);
  }

  /** @inheritdoc */
  public async issue(payload: AuthResponseDto): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    const ttl = this.env.ssoExchangeCodeTtlSeconds;
    const key = SsoCodeStore.KEY_PREFIX + code;
    this.logger.log(`issue — start | ttl: ${ttl}s`);
    await this.redis.set(key, JSON.stringify(payload), ttl);
    this.logger.log(`issue — complete`);
    return code;
  }

  /** @inheritdoc */
  public async consume(code: string): Promise<AuthResponseDto> {
    const key = SsoCodeStore.KEY_PREFIX + code;
    this.logger.log(`consume — start`);

    const raw = await this.redis.get(key);
    if (!raw) {
      this.logger.warn(`consume — code not found or expired`);
      throw new TranslatableException({
        messageKey: 'error.auth.sso_exchange_invalid',
        errorCode: ERROR_CODES.AUTH_SSO_EXCHANGE_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    // Atomic single-use: delete immediately after read so a second consume
    // always misses. Done as a follow-up DEL because RedisService doesn't
    // expose GETDEL — race window is bounded to a single Redis round-trip.
    await this.redis.del(key);

    let payload: AuthResponseDto;
    try {
      payload = JSON.parse(raw) as AuthResponseDto;
    } catch (err) {
      this.logger.error(
        `consume — corrupted payload | error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new TranslatableException({
        messageKey: 'error.auth.sso_exchange_invalid',
        errorCode: ERROR_CODES.AUTH_SSO_EXCHANGE_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    this.logger.log(`consume — complete`);
    return payload;
  }
}
