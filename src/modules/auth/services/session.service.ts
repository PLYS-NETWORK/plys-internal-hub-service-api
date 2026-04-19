import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@common/modules/environments';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { ActivePlatform } from '@database/enums/active-platform.enum';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { randomBytes } from 'crypto';

import { AuthResponseDto } from '../dto/responses/auth-response.dto';
import { UserResponseDto } from '../dto/responses/user-response.dto';
import { ISessionContext, ISessionService } from '../interfaces/auth-service.interface';
import { parseDuration, sha256 } from '../utils/auth.utils';

@Injectable()
export class SessionService implements ISessionService {
  private readonly logger = new Logger(SessionService.name);

  private get rid(): string {
    return this.requestContext.requestId;
  }

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly jwtService: JwtService,
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {}

  public async me(): Promise<UserResponseDto> {
    const userId = this.requestContext.userId;
    this.logger.log(`[${this.rid}] me — start | userId: ${userId}`);

    const user = userId ? await this.uow.users.findByActiveId(userId) : null;

    if (!user || !user.isActive) {
      this.logger.warn(`[${this.rid}] me — user not found or inactive | userId: ${userId}`);
      throw new TranslatableException({
        messageKey: 'error.auth.user_not_found',
        errorCode: ERROR_CODES.AUTH_USER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      });
    }

    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  public async refresh(refreshToken: string, context: ISessionContext): Promise<AuthResponseDto> {
    this.logger.log(`[${this.rid}] refresh — start`);
    const tokenHash = sha256(refreshToken);

    const session = await this.uow.userSessions.findOne({
      where: { sessionToken: tokenHash },
      relations: ['user'],
    });

    if (!session) {
      this.logger.warn(`[${this.rid}] refresh — session not found`);
      throw new TranslatableException({
        messageKey: 'error.auth.token_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    if (session.expiresAt < new Date()) {
      this.logger.warn(`[${this.rid}] refresh — session expired | sessionId: ${session.id}`);
      // Clean up expired session
      await this.uow.userSessions.remove(session);
      throw new TranslatableException({
        messageKey: 'error.auth.token_expired',
        errorCode: ERROR_CODES.AUTH_TOKEN_EXPIRED,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    const { userId, user } = session;

    // Refresh Token Rotation: delete old session, create fresh one.
    // The platform is re-read from the user (the session no longer carries it).
    await this.uow.userSessions.remove(session);

    this.logger.log(`[${this.rid}] refresh — complete | userId: ${userId}`);
    return this.createSession(userId, user.email, user.platform, context);
  }

  public async logout(): Promise<void> {
    const sessionId = this.requestContext.sessionId;
    this.logger.log(`[${this.rid}] logout — start | sessionId: ${sessionId}`);
    if (sessionId) {
      await this.uow.userSessions.delete({ id: sessionId });
    } else {
      this.logger.warn(`[${this.rid}] logout — no active session to invalidate`);
    }
    this.logger.log(`[${this.rid}] logout — complete`);
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
    const accessToken = this.jwtService.sign(jwtPayload, {
      secret: this.envService.jwtAccessSecret,
      expiresIn: accessExpiresIn,
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
}
