import { HttpStatus, Injectable } from '@nestjs/common';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ActivePlatform } from '@plys/libraries/database/enums';
import { randomBytes } from 'crypto';

import { ERROR_CODES } from '@/errors/error-codes';

interface OAuthStateRecord {
  readonly activePlatform: ActivePlatform;
  readonly createdAt: string;
}

@Injectable()
export class OAuthStateStore {
  private readonly logger: AppLogger;
  private static readonly KEY_PREFIX = 'sso:oauth-state:';
  private static readonly TTL_SECONDS = 600;

  constructor(
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(OAuthStateStore.name, requestContext);
  }

  public async issue(activePlatform: ActivePlatform): Promise<string> {
    const nonce = randomBytes(32).toString('base64url');
    const key = OAuthStateStore.KEY_PREFIX + nonce;
    const record: OAuthStateRecord = {
      activePlatform,
      createdAt: new Date().toISOString(),
    };
    await this.redis.set(key, JSON.stringify(record), OAuthStateStore.TTL_SECONDS);
    return nonce;
  }

  public async consume(nonce: string): Promise<OAuthStateRecord> {
    const key = OAuthStateStore.KEY_PREFIX + nonce;
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new TranslatableException({
        messageKey: 'error.auth.oauth_state_invalid',
        errorCode: ERROR_CODES.AUTH_OAUTH_STATE_INVALID,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    await this.redis.del(key);
    try {
      return JSON.parse(raw) as OAuthStateRecord;
    } catch {
      throw new TranslatableException({
        messageKey: 'error.auth.oauth_state_invalid',
        errorCode: ERROR_CODES.AUTH_OAUTH_STATE_INVALID,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }
}
