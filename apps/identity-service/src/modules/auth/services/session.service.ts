import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { JwtPayload } from '@plys/libraries/common-nest/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RedisService } from '@plys/libraries/common-nest/modules/redis/redis.service';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ActivePlatform } from '@plys/libraries/database/enums';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { plainToInstance } from 'class-transformer';

import { ERROR_CODES } from '../../../errors/error-codes';
import { AuthResponseDto } from '../dto/responses/auth-response.dto';
import { UserResponseDto } from '../dto/responses/user-response.dto';
import { ISessionContext, ISessionService } from '../interfaces/auth-service.interface';
import { parseDuration, sha256 } from '../utils/auth.utils';

// How long to hold the per-token idempotency lock while the DB transaction runs.
const REFRESH_LOCK_TTL_SECONDS = 5;
// How long to cache a successful refresh result so concurrent callers can read it.
const REFRESH_RESULT_TTL_SECONDS = 10;
// How long a concurrent caller waits before reading the cached result.
const REFRESH_LOCK_WAIT_MS = 200;

@Injectable()
export class SessionService implements ISessionService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly jwtService: JwtService,
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
    private readonly redis: RedisService,
  ) {
    this.logger = new AppLogger(SessionService.name, requestContext);
  }

  public async me(): Promise<UserResponseDto> {
    const userId = this.requestContext.userId;
    this.logger.log(`me — start | userId: ${userId}`);

    const user = userId ? await this.uow.users.findByActiveId(userId) : null;

    if (!user || !user.isActive) {
      this.logger.warn(`me — user not found or inactive | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.auth.user_not_found',
        errorCode: ERROR_CODES.AUTH_USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  /**
   * Single-use refresh-token rotation.
   *
   * The lookup-and-mark sequence is wrapped in a pessimistic_write lock so
   * two concurrent calls with the same token cannot both succeed: the first
   * caller wins and stamps `used_at`; the second sees no active row and is
   * rejected. If the supplied token matches a session that is *already*
   * used, that's strong evidence of replay — every session for that user is
   * revoked.
   */
  public async refresh(refreshToken: string, context: ISessionContext): Promise<AuthResponseDto> {
    const tokenHash = sha256(refreshToken);
    const keyPrefix = tokenHash.slice(0, 16);
    const lockKey = `auth:refresh:lock:${keyPrefix}`;
    const resultKey = `auth:refresh:result:${keyPrefix}`;

    this.logger.log(
      `refresh — start | tokenTail: ${refreshToken.slice(-8)}, hashPrefix: ${tokenHash.slice(0, 12)}`,
    );

    // Acquire a short-lived distributed lock so concurrent calls with the same
    // refresh token (React StrictMode double-mount, multi-tab) do not both
    // enter the DB transaction. The first caller wins the lock; subsequent
    // callers wait briefly and read the cached result instead of triggering
    // the single-use token's replay-detection path.
    const acquired = await this.redis.setNx(lockKey, '1', REFRESH_LOCK_TTL_SECONDS);

    if (!acquired) {
      this.logger.log(`refresh — lock busy, awaiting cached result | hashPrefix: ${keyPrefix}`);
      return this.awaitRefreshResult(resultKey, keyPrefix);
    }

    // We hold the lock — run the existing single-use rotation logic.
    let reuseUserId: string | null = null;
    let result: { userId: string; user: { email: string; platform: ActivePlatform } };

    try {
      result = await this.uow.withTransaction(async (tx) => {
        const session = await tx.userSessions.findActiveByTokenForUpdate(tokenHash);
        this.logger.log(
          `refresh — findActiveByTokenForUpdate | found: ${!!session}, sessionId: ${session?.id ?? 'n/a'}, userId: ${session?.userId ?? 'n/a'}`,
        );

        if (!session) {
          const existing = await tx.userSessions.findByToken(tokenHash);
          if (existing?.usedAt) {
            reuseUserId = existing.userId;
            this.logger.error(
              `refresh — token reuse detected | userId: ${existing.userId}, sessionId: ${existing.id}`,
            );
          } else {
            this.logger.warn(`refresh — session not found`);
          }
          throw new TranslatableException({
            messageKey: 'error.auth.token_invalid',
            errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
            status: HttpStatus.UNAUTHORIZED,
          });
        }

        if (session.expiresAt < new Date()) {
          this.logger.warn(`refresh — session expired | sessionId: ${session.id}`);
          await tx.userSessions.delete({ id: session.id });
          throw new TranslatableException({
            messageKey: 'error.auth.token_expired',
            errorCode: ERROR_CODES.AUTH_TOKEN_EXPIRED,
            status: HttpStatus.UNAUTHORIZED,
          });
        }

        session.usedAt = new Date();
        await tx.userSessions.save(session);

        return { userId: session.userId, user: session.user };
      });
    } catch (err) {
      if (reuseUserId) {
        await this.revokeAllSessionsForUser(reuseUserId);
      }
      throw err;
    }

    this.logger.log(
      `refresh — transaction complete | userId: ${result.userId}, platform: ${result.user.platform}`,
    );

    const dto = await this.createSession(
      result.userId,
      result.user.email,
      result.user.platform,
      context,
    );

    // Cache the result so concurrent waiters can return it without re-entering the DB.
    await this.redis.set(resultKey, JSON.stringify(dto), REFRESH_RESULT_TTL_SECONDS);

    return dto;
  }

  /**
   * Called when the per-token lock is already held by another in-flight refresh.
   * Waits up to two 200 ms intervals for the primary caller to populate the
   * result cache, then returns the cached AuthResponseDto.
   *
   * If the primary call fails (no result appears within ~400 ms), throws a
   * generic token-invalid error — this avoids triggering replay detection or
   * session revocation for what is merely a concurrent duplicate request.
   */
  private async awaitRefreshResult(resultKey: string, keyPrefix: string): Promise<AuthResponseDto> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await new Promise<void>((resolve) => setTimeout(resolve, REFRESH_LOCK_WAIT_MS));
      const raw = await this.redis.get(resultKey);
      if (raw) {
        this.logger.log(
          `refresh — served from result cache | hashPrefix: ${keyPrefix}, attempt: ${attempt}`,
        );
        return plainToInstance(AuthResponseDto, JSON.parse(raw) as object, {
          excludeExtraneousValues: true,
        });
      }
    }

    this.logger.warn(
      `refresh — concurrent call timed out waiting for result | hashPrefix: ${keyPrefix}`,
    );
    throw new TranslatableException({
      messageKey: 'error.auth.token_invalid',
      errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
      status: HttpStatus.UNAUTHORIZED,
    });
  }

  public async logout(): Promise<void> {
    const sessionId = this.requestContext.sessionId;
    this.logger.log(`logout — start | sessionId: ${sessionId}`);
    if (sessionId) {
      await this.uow.userSessions.delete({ id: sessionId });
    } else {
      this.logger.warn(`logout — no active session to invalidate`);
    }
    this.logger.log(`logout — complete`);
  }

  public async createSession(
    userId: string,
    email: string,
    activePlatform: ActivePlatform,
    context: ISessionContext,
  ): Promise<AuthResponseDto> {
    // Fetch user first so role is available for the JWT payload
    const user = await this.uow.users.findByActiveId(userId);

    if (!user) {
      throw new TranslatableException({
        messageKey: 'error.auth.user_not_found',
        errorCode: ERROR_CODES.AUTH_USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // Sign a JWT refresh token; only its SHA-256 is persisted so a DB breach
    // never exposes a usable token. The strategy verifies the JWT signature
    // before the controller receives the request.
    const rawRefreshToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.envService.jwtRefreshSecret,
        expiresIn: this.envService.jwtRefreshExpiration,
        algorithm: 'HS256',
        issuer: this.envService.jwtIssuer,
        audience: this.envService.jwtAudience,
      },
    );
    const sessionTokenHash = sha256(rawRefreshToken);

    const refreshExpirationMs = parseDuration(this.envService.jwtRefreshExpiration);
    const expiresAt = new Date(Date.now() + refreshExpirationMs);

    this.logger.log(
      `createSession — inserting session | userId: ${userId}, platform: ${activePlatform}, hashPrefix: ${sessionTokenHash.slice(0, 12)}, ipAddress: ${context.ipAddress || null}, deviceId: ${context.deviceId}, expiresAt: ${expiresAt.toISOString()}`,
    );
    const session = this.uow.userSessions.create({
      userId,
      sessionToken: sessionTokenHash,
      deviceId: context.deviceId,
      fingerprint: context.fingerprint,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent,
      // Captured from the x-timezone header at login time so analytics + audit
      // can recover the consultant's wall-clock without trusting the live header.
      timezone: this.requestContext.timezone,
      expiresAt,
      usedAt: null,
    });
    try {
      await this.uow.userSessions.save(session);
      this.logger.log(`createSession — session saved | sessionId: ${session.id}`);
    } catch (err: unknown) {
      const qfe = err as {
        name?: string;
        message?: string;
        driverError?: { code?: string; message?: string; detail?: string };
      };
      this.logger.error(
        `createSession — save failed | name: ${qfe?.name}, message: ${qfe?.message}, pgCode: ${qfe?.driverError?.code}, pgDetail: ${qfe?.driverError?.detail ?? qfe?.driverError?.message}`,
      );
      throw err;
    }

    // BusinessProfile.id is embedded in the access token only when the user is
    // signing in as a business — keeps a fast `requestContext.businessId` path
    // for the project-business module without an extra DB lookup per request.
    // Repositories still double-check ownership via findOneByUserAndId so a
    // tampered claim cannot grant cross-tenant access.
    let businessId: string | undefined;
    if (activePlatform === ActivePlatform.BUSINESS) {
      const businessProfile = await this.uow.businessProfiles.findByUserId(userId);
      businessId = businessProfile?.id;
    }

    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      role: user.role,
      activePlatform,
      sessionId: session.id,
      deviceId: context.deviceId,
      ...(businessId ? { businessId } : {}),
    };

    const accessExpiresIn = this.envService.jwtAccessExpiration;
    // iss/aud/algorithm are pinned on every newly signed token so verifiers
    // can scope tokens to this service and reject alg-confusion attacks.
    const accessToken = this.jwtService.sign(jwtPayload, {
      secret: this.envService.jwtAccessSecret,
      expiresIn: accessExpiresIn,
      algorithm: 'HS256',
      issuer: this.envService.jwtIssuer,
      audience: this.envService.jwtAudience,
    });

    return plainToInstance(
      AuthResponseDto,
      {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: parseDuration(accessExpiresIn) / 1000,
        user: plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true }),
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Revokes all sessions for the given user. Called after password reset and
   * to short-circuit a refresh-token replay event (where reuse was detected).
   */
  public async revokeAllSessionsForUser(userId: string): Promise<void> {
    this.logger.log(`revokeAllSessionsForUser — start | userId: ${userId}`);
    await this.uow.userSessions.delete({ userId });
    this.logger.log(`revokeAllSessionsForUser — complete | userId: ${userId}`);
  }
}
