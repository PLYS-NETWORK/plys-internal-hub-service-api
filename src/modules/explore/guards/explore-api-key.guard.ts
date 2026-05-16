import { timingSafeEqual } from 'node:crypto';

import { ERROR_CODES } from '@common/constants/error-codes';
import { TranslatableException } from '@common/exceptions/translatable.exception';
import { EnvironmentsService } from '@common/modules/environments';
import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Injectable()
export class ExploreApiKeyGuard implements CanActivate {
  constructor(private readonly env: EnvironmentsService) {}

  public canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const headerValue = req.headers['x-api-key'];
    const provided = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const expected = this.env.publicEndpointApiKey;

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
