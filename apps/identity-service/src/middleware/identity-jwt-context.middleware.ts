import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { JwtPayload } from '@plys/libraries/common-nest/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { ActivePlatform, UserRole } from '@plys/libraries/database/enums';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Local session validation for identity-service (session owner).
 * Other services use IdentitySessionClient gRPC instead.
 */
@Injectable()
export class IdentityJwtContextMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
    private readonly uow: UnitOfWorkService,
  ) {}

  public async use(req: FastifyRequest, _res: FastifyReply, next: () => void): Promise<void> {
    const authorization = req.headers['authorization'];
    if (!authorization?.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authorization.slice(7);
    try {
      const strict = this.envService.jwtStrictClaims;
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.envService.jwtAccessSecret,
        algorithms: ['HS256'],
        issuer: strict ? this.envService.jwtIssuer : undefined,
        audience: strict ? this.envService.jwtAudience : undefined,
      });

      if (!strict) {
        if (payload.iss !== undefined && payload.iss !== this.envService.jwtIssuer) {
          throw new TranslatableException({
            messageKey: 'error.auth.token_invalid',
            errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
            status: HttpStatus.UNAUTHORIZED,
          });
        }
        if (payload.aud !== undefined && payload.aud !== this.envService.jwtAudience) {
          throw new TranslatableException({
            messageKey: 'error.auth.token_invalid',
            errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
            status: HttpStatus.UNAUTHORIZED,
          });
        }
      }

      const requestDeviceId = (req.headers as Record<string, string>)['x-device-id'] ?? null;
      if (payload.deviceId && requestDeviceId !== null && requestDeviceId !== payload.deviceId) {
        throw new TranslatableException({
          messageKey: 'error.auth.device_mismatch',
          errorCode: ERROR_CODES.AUTH_DEVICE_MISMATCH,
          status: HttpStatus.UNAUTHORIZED,
        });
      }

      if (!payload.sessionId) {
        throw new TranslatableException({
          messageKey: 'error.auth.token_invalid',
          errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
          status: HttpStatus.UNAUTHORIZED,
        });
      }

      const session = await this.uow.userSessions.findByActiveId(payload.sessionId);
      if (!session || session.usedAt !== null || session.expiresAt < new Date()) {
        throw new TranslatableException({
          messageKey: 'error.auth.token_invalid',
          errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
          status: HttpStatus.UNAUTHORIZED,
        });
      }

      this.requestContext.setUser(
        payload.sub,
        payload.email,
        payload.role as UserRole,
        payload.sessionId,
        payload.deviceId,
        payload.activePlatform as ActivePlatform,
        payload.businessId ?? null,
      );
      this.requestContext.setSessionTimezone(session.timezone);
    } catch (err) {
      if (err instanceof TranslatableException) {
        throw err;
      }
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        throw new TranslatableException({
          messageKey: 'error.auth.token_expired',
          errorCode: ERROR_CODES.AUTH_TOKEN_EXPIRED,
          status: HttpStatus.UNAUTHORIZED,
        });
      }
      if (err instanceof Error && err.name === 'JsonWebTokenError') {
        throw new TranslatableException({
          messageKey: 'error.auth.token_invalid',
          errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
          status: HttpStatus.UNAUTHORIZED,
        });
      }
      throw err;
    }
    next();
  }
}
