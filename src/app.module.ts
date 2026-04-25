import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PlatformGuard } from './common/guards/platform.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { JwtContextMiddleware } from './common/middleware/jwt-context.middleware';
import { CopyleaksModule } from './common/modules/copyleaks';
import { EmailModule } from './common/modules/email';
import { EnvironmentsModule, EnvironmentsService } from './common/modules/environments';
import { FilesModule } from './common/modules/files';
import { I18nModule } from './common/modules/i18n';
import { PaymentModule } from './common/modules/payment';
import { RedisModule } from './common/modules/redis';
import { RequestContextMiddleware, RequestContextModule } from './common/modules/request-context';
import configuration from './config/configuration';
import { resolveEnvFilePath } from './config/env-file.config';
import { AuditSubscriber } from './database/subscribers/audit.subscriber';
import { getTypeOrmConfig } from './database/typeorm.config';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { PaymentsModule } from './modules/payments';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SkillsModule } from './modules/skills/skills.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UnitOfWorkModule } from './modules/unit-of-work/unit-of-work.module';
import { UsersModule } from './modules/users/users.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePath(),
      load: [configuration],
    }),
    EnvironmentsModule,
    TypeOrmModule.forRootAsync({
      imports: [EnvironmentsModule],
      inject: [EnvironmentsService],
      useFactory: (envService: EnvironmentsService) => getTypeOrmConfig(envService),
    }),
    I18nModule,
    ScheduleModule.forRoot(),
    RequestContextModule,
    EmailModule,
    CopyleaksModule,
    RedisModule,
    PaymentModule,
    UnitOfWorkModule,
    FilesModule,
    ApplicationsModule,
    AuthModule,
    BillingModule,
    PaymentsModule,
    ProfilesModule,
    ProjectsModule,
    SkillsModule,
    TasksModule,
    UsersModule,
    WebhooksModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
    // JwtAuthGuard is global — use @Public() on routes that don't require authentication
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PlatformGuard },
    AuditSubscriber,
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });

    // JwtContextMiddleware runs after RequestContextMiddleware so the AsyncLocalStorage
    // context is already established when the JWT payload is written into it.
    consumer.apply(JwtContextMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
