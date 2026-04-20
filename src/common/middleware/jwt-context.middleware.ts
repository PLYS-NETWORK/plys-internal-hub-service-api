import { JwtPayload } from '@common/interfaces/jwt-payload.interface';
import { EnvironmentsService } from '@common/modules/environments';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Injectable, NestMiddleware } from '@nestjs/common';
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
          // Device mismatch — leave userId null so JwtAuthGuard rejects the request.
          return next();
        }

        this.requestContext.setUser(
          payload.sub,
          payload.email,
          payload.role,
          payload.sessionId,
          payload.deviceId,
          payload.activePlatform,
        );
      } catch {
        // Invalid or expired token — context userId stays null.
        // JwtAuthGuard will reject protected routes.
      }
    }
    next();
  }
}
