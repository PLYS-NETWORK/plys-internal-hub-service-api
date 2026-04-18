import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { EmailModule } from './common/modules/email';
import { EnvironmentsModule } from './common/modules/environments';
import { I18nModule } from './common/modules/i18n';
import {
  RequestContextInterceptor,
  RequestContextMiddleware,
  RequestContextModule,
} from './common/modules/request-context';
import configuration from './config/configuration';
import { AuditSubscriber } from './database/subscribers/audit.subscriber';
import { getTypeOrmConfig } from './database/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { UnitOfWorkModule } from './modules/unit-of-work/unit-of-work.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => getTypeOrmConfig(),
    }),
    EnvironmentsModule,
    I18nModule,
    RequestContextModule,
    EmailModule,
    UnitOfWorkModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    // RequestContextInterceptor runs after guards to populate userId/role from the validated JWT
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    // JwtAuthGuard is global — use @Public() on routes that don't require authentication
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // AuditSubscriber self-registers with the DataSource in its constructor; listing it
    // here ensures NestJS instantiates it (and injects RequestContextService) at boot.
    AuditSubscriber,
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    // RequestContextMiddleware runs first — creates the AsyncLocalStorage context
    // for every incoming request before any guard or interceptor executes.
    consumer.apply(RequestContextMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
