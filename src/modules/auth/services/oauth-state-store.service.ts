import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ActivePlatform } from '@database/enums';
import { HttpStatus, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

import { IOAuthStateRecord, IOAuthStateStore } from '../interfaces/oauth-state-store.interface';

/**
 * CSRF defence for the Google OAuth flow.
 *
 * On `GET /auth/sso/google` we generate a random nonce, persist `{ activePlatform }`
 * under it in Redis with a 10-minute TTL, and pass the nonce as `state` to
 * Google. The callback then `consume`s the nonce — if it's missing the
 * caller didn't initiate the flow we redirected them to (CSRF or replay).
 */
@Injectable()
export class OAuthStateStore implements IOAuthStateStore {
  private readonly logger: AppLogger;
  private static readonly KEY_PREFIX = 'sso:oauth-state:';
  private static readonly TTL_SECONDS = 600;

  constructor(
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(OAuthStateStore.name, requestContext);
  }

  /** @inheritdoc */
  public async issue(activePlatform: ActivePlatform): Promise<string> {
    const nonce = randomBytes(32).toString('base64url');
    const key = OAuthStateStore.KEY_PREFIX + nonce;
    const record: IOAuthStateRecord = {
      activePlatform,
      createdAt: new Date().toISOString(),
    };
    this.logger.log(`issue — start | platform: ${activePlatform}`);
    await this.redis.set(key, JSON.stringify(record), OAuthStateStore.TTL_SECONDS);
    this.logger.log(`issue — complete`);
    return nonce;
  }

  /** @inheritdoc */
  public async consume(nonce: string): Promise<IOAuthStateRecord> {
    const key = OAuthStateStore.KEY_PREFIX + nonce;
    this.logger.log(`consume — start`);

    const raw = await this.redis.get(key);
    if (!raw) {
      this.logger.warn(`consume — state not found or expired`);
      throw new TranslatableException({
        messageKey: 'error.auth.oauth_state_invalid',
        errorCode: ERROR_CODES.AUTH_OAUTH_STATE_INVALID,
        status: HttpStatus.BAD_REQUEST,
      });
    }
    await this.redis.del(key);

    try {
      return JSON.parse(raw) as IOAuthStateRecord;
    } catch (err) {
      this.logger.error(
        `consume — corrupted state | error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new TranslatableException({
        messageKey: 'error.auth.oauth_state_invalid',
        errorCode: ERROR_CODES.AUTH_OAUTH_STATE_INVALID,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }
}
