import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { GlobalExceptionFilter } from '@plys/libraries/common-nest/filters/global-exception.filter';
import { JwtAuthGuard } from '@plys/libraries/common-nest/guards/jwt-auth.guard';
import { PlatformGuard } from '@plys/libraries/common-nest/guards/platform.guard';
import { RolesGuard } from '@plys/libraries/common-nest/guards/roles.guard';
import { TransformResponseInterceptor } from '@plys/libraries/common-nest/interceptors/transform-response.interceptor';
import { JwtContextMiddleware } from '@plys/libraries/common-nest/middleware/jwt-context.middleware';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import { I18nModule } from '@plys/libraries/common-nest/modules/i18n';
import { appWinstonOptions } from '@plys/libraries/common-nest/modules/logger';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis';
import {
  RequestContextMiddleware,
  RequestContextModule,
} from '@plys/libraries/common-nest/modules/request-context';
import { resolveEnvFilePath } from '@plys/libraries/config/env-file.config';
import { WinstonModule } from 'nest-winston';

import {
  AiProviderClientsModule,
  BusinessClientsModule,
  ConsultantClientsModule,
  FinanceClientsModule,
  IdentityClientsModule,
  InternalAdminClientsModule,
  InternalTaskReviewerClientsModule,
  NotificationsClientsModule,
  PlatformClientsModule,
} from '@/clients';
import { AiProviderHttpModule } from '@/http/v1/ai-provider/ai-provider-http.module';
import { BusinessHttpModule } from '@/http/v1/business/business-http.module';
import { ConsultantHttpModule } from '@/http/v1/consultant/consultant-http.module';
import { FinanceHttpModule } from '@/http/v1/finance/finance-http.module';
import { GatewayHealthModule } from '@/http/v1/gateway/gateway-health.module';
import { IdentityHttpModule } from '@/http/v1/identity/identity-http.module';
import { InternalAdminHttpModule } from '@/http/v1/internal-admin/internal-admin-http.module';
import { InternalTaskReviewerHttpModule } from '@/http/v1/internal-task-reviewer/internal-task-reviewer-http.module';
import { NotificationsHttpModule } from '@/http/v1/notifications/notifications-http.module';
import { PlatformHttpModule } from '@/http/v1/platform/platform-http.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePath(),
    }),
    WinstonModule.forRoot(appWinstonOptions),
    EnvironmentsModule,
    ThrottlerModule.forRootAsync({
      inject: [EnvironmentsService],
      useFactory: (env: EnvironmentsService) => ({
        throttlers: [{ name: 'default', limit: 60, ttl: 60_000 }],
        storage: new ThrottlerStorageRedisService({
          host: env.redisHost,
          port: env.redisPort,
          password: env.redisPassword,
          db: env.redisDb,
          tls: env.redisTlsEnabled ? {} : undefined,
          keyPrefix: `${env.redisKeyPrefix}${env.throttleRedisPrefix}`,
        }),
      }),
    }),
    I18nModule,
    RequestContextModule,
    RedisModule,
    IdentityClientsModule,
    BusinessClientsModule,
    ConsultantClientsModule,
    InternalAdminClientsModule,
    InternalTaskReviewerClientsModule,
    FinanceClientsModule,
    NotificationsClientsModule,
    PlatformClientsModule,
    AiProviderClientsModule,
    JwtModule.register({}),
    GatewayHealthModule,
    IdentityHttpModule,
    BusinessHttpModule,
    ConsultantHttpModule,
    InternalAdminHttpModule,
    InternalTaskReviewerHttpModule,
    FinanceHttpModule,
    NotificationsHttpModule,
    PlatformHttpModule,
    AiProviderHttpModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PlatformGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
    consumer.apply(JwtContextMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
