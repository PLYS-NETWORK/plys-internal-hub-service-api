import { timingSafeEqual } from 'node:crypto';

import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@plys/libraries/common-nest/constants/error-codes';
import { HEADERS } from '@plys/libraries/common-nest/constants/headers';
import { TranslatableException } from '@plys/libraries/common-nest/exceptions/translatable.exception';
import { FastifyRequest } from 'fastify';

/**
 * Validates the `x-api-key` header against `PUBLIC_ENDPOINT_API_KEY` for
 * routes exposed to first-party BFFs that authenticate at the edge instead
 * of carrying a JWT. Uses `timingSafeEqual` so a mismatched-length input
 * fails fast without leaking timing data.
 *
 * Depends on `ConfigService` (global `ConfigModule`) rather than
 * `EnvironmentsService` so the guard resolves in api-gateway feature modules
 * that mount shared controllers without importing `EnvironmentsModule`.
 */
@Injectable()
export class PublicEndpointApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  public canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const headerValue = req.headers[HEADERS.X_API_KEY];
    const provided = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const expected = this.configService.get<string>('app.security.publicEndpointApiKey', '');

    // Fail closed when the secret hasn't been provisioned for this environment.
    // timingSafeEqual requires both buffers to be the same length, so a length
    // check up front lets us reject mismatches without leaking timing info via
    // the Buffer.from path below.
    if (
      !expected ||
      typeof provided !== 'string' ||
      provided.length !== expected.length ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
    ) {
      throw new TranslatableException({
        messageKey: 'error.auth.api_key_invalid',
        errorCode: ERROR_CODES.AUTH_TOKEN_INVALID,
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    return true;
  }
}
