import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@common/modules/environments';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@modules/unit-of-work/unit-of-work.service';
import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';

@Injectable()
export class JwtContextMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
    private readonly uow: UnitOfWorkService,
  ) {}

  // Runs after RequestContextMiddleware (AsyncLocalStorage is already established).
  // Extracts the Bearer token, verifies it, and writes the user identity into the
  // request context so all guards/services can read it without touching request.user.
  public async use(req: FastifyRequest, _res: FastifyReply, next: () => void): Promise<void> {
    const authorization = req.headers['authorization'];
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7);
      try {
        // Algorithm pinning prevents alg-confusion attacks. iss/aud are
        // asserted to scope tokens to this service; in non-strict mode we
        // allow tokens missing the claims so a deploy can land before all
        // live tokens carry them.
        const strict = this.envService.jwtStrictClaims;
        const payload = this.jwtService.verify<JwtPayload>(token, {
          secret: this.envService.jwtAccessSecret,
          algorithms: ['HS256'],
          issuer: strict ? this.envService.jwtIssuer : undefined,
          audience: strict ? this.envService.jwtAudience : undefined,
        });

        // In non-strict mode we still validate iss/aud when present so a
        // tampered claim is rejected even before strict mode is on.
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

        // Device-binding: reject only when the client sends x-device-id but it doesn't match
        // the JWT. If the header is absent (e.g. browser clients) the check is skipped —
        // enforcement requires the client to opt in by sending the header.
        const requestDeviceId = (req.headers as Record<string, string>)['x-device-id'] ?? null;
        if (payload.deviceId && requestDeviceId !== null && requestDeviceId !== payload.deviceId) {
          throw new TranslatableException({
            messageKey: 'error.auth.device_mismatch',
            errorCode: ERROR_CODES.AUTH_DEVICE_MISMATCH,
            status: HttpStatus.UNAUTHORIZED,
          });
        }

        // Session-existence check: JWTs are stateless, so a logged-out / rotated /
        // revoked session would otherwise keep accepting its access token until the
        // short TTL expires. Reject when the row is gone (logout, password reset),
        // when usedAt is stamped (refresh has rotated the pair), or when the session
        // window has elapsed.
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
          payload.role,
          payload.sessionId,
          payload.deviceId,
          payload.activePlatform,
          payload.businessId ?? null,
        );
      } catch (err) {
        if (err instanceof TranslatableException) {
          throw err;
        }
        // jsonwebtoken is a transitive dep — check by error name to avoid a direct import.
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
        // Unexpected error — rethrow so GlobalExceptionFilter logs it.
        throw err;
      }
    }
    next();
  }
}
