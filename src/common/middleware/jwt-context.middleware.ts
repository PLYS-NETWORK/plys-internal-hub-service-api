import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@common/modules/environments';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyReply, FastifyRequest } from 'fastify';

@Injectable()
export class JwtContextMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly envService: EnvironmentsService,
    private readonly requestContext: RequestContextService,
  ) {}

  // Runs after RequestContextMiddleware (AsyncLocalStorage is already established).
  // Extracts the Bearer token, verifies it, and writes the user identity into the
  // request context so all guards/services can read it without touching request.user.
  public use(req: FastifyRequest, _res: FastifyReply, next: () => void): void {
    const authorization = req.headers['authorization'];
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7);
      try {
        const payload = this.jwtService.verify<JwtPayload>(token, {
          secret: this.envService.jwtAccessSecret,
        });

        // Device-binding: if the JWT declares a deviceId the request must originate from the same device.
        const requestDeviceId = (req.headers as Record<string, string>)['x-device-id'] ?? null;
        if (payload.deviceId && requestDeviceId !== payload.deviceId) {
          throw new TranslatableException({
            messageKey: 'error.auth.device_mismatch',
            errorCode: ERROR_CODES.AUTH_DEVICE_MISMATCH,
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
