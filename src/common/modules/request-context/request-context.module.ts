import { Global, Module } from '@nestjs/common';

import { RequestContextInterceptor } from './request-context.interceptor';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

@Global()
@Module({
  providers: [RequestContextService, RequestContextMiddleware, RequestContextInterceptor],
  exports: [RequestContextService, RequestContextMiddleware, RequestContextInterceptor],
})
export class RequestContextModule {}
