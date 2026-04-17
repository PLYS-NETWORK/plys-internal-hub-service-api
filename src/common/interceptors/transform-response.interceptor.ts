import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { StandardizedResponse } from '../response/standardized-response';

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, StandardizedResponse<T>>
{
  public intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<StandardizedResponse<T>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    return next.handle().pipe(
      map(
        (data: T) =>
          new StandardizedResponse<T>(response.statusCode, 'OK', data, request.url),
      ),
    );
  }
}
