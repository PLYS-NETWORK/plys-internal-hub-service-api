import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '@plys/libraries/common-nest/interfaces/jwt-payload.interface';
import { FastifyRequest } from 'fastify';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest & { user: JwtPayload }>();
    return request.user;
  },
);
