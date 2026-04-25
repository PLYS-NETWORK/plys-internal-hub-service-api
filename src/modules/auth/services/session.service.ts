import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@common/modules/environments';
import { AppLogger } from '@common/modules/logger';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ActivePlatform } from '@database/enums';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { randomBytes } from 'crypto';

import { AuthResponseDto } from '../dto/responses/auth-response.dto';
import { UserResponseDto } from '../dto/responses/user-response.dto';
import { ISessionContext, ISessionService } from '../interfaces/auth-service.interface';
import { parseDuration, sha256 } from '../utils/auth.utils';

@Injectable()
export class SessionService implements ISessionService {
  private readonly logger: AppLogger;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly jwtService: JwtService,
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
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
    this.logger.log(`refresh — start`);
    const tokenHash = sha256(refreshToken);

    const result = await this.uow.withTransaction(async (tx) => {
      const session = await tx.userSessions.findActiveByTokenForUpdate(tokenHash);

      if (!session) {
        // Either the token never existed or it has already been used. Detect
        // reuse so we can revoke all sessions for the impacted user.
        const existing = await tx.userSessions.findByToken(tokenHash);
        if (existing && existing.usedAt) {
          this.logger.error(
            `refresh — token reuse detected | userId: ${existing.userId}, sessionId: ${existing.id}`,
          );
          await tx.userSessions.delete({ userId: existing.userId });
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

      // Mark as consumed inside the lock — second concurrent caller will find
      // no active row and be rejected.
      session.usedAt = new Date();
      await tx.userSessions.save(session);

      return { userId: session.userId, user: session.user };
    });

    this.logger.log(`refresh — complete | userId: ${result.userId}`);
    return this.createSession(result.userId, result.user.email, result.user.platform, context);
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

    // Generate an opaque refresh token; only its SHA-256 is persisted
    const rawRefreshToken = randomBytes(48).toString('base64url');
    const sessionTokenHash = sha256(rawRefreshToken);

    const refreshExpirationMs = parseDuration(this.envService.jwtRefreshExpiration);
    const expiresAt = new Date(Date.now() + refreshExpirationMs);

    const session = this.uow.userSessions.create({
      userId,
      sessionToken: sessionTokenHash,
      deviceId: context.deviceId,
      fingerprint: context.fingerprint,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent,
      expiresAt,
      usedAt: null,
    });
    await this.uow.userSessions.save(session);

    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      role: user.role,
      activePlatform,
      sessionId: session.id,
      deviceId: context.deviceId,
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
