import { BullModule } from '@nestjs/bull';
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';

import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PlatformGuard } from './common/guards/platform.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { JwtContextMiddleware } from './common/middleware/jwt-context.middleware';
import { AwsS3Module } from './common/modules/aws-s3';
import { CopyleaksModule } from './common/modules/copyleaks';
import { EmailModule } from './common/modules/email';
import { EnvironmentsModule, EnvironmentsService } from './common/modules/environments';
import { FileStorageModule } from './common/modules/file-storage';
import { HttpLoggerMiddleware } from './common/modules/http-logger';
import { I18nModule } from './common/modules/i18n';
import { appWinstonOptions } from './common/modules/logger';
import { PaymentModule } from './common/modules/payment';
import { RedisModule } from './common/modules/redis';
import { RequestContextMiddleware, RequestContextModule } from './common/modules/request-context';
import { ServerAiModule } from './common/modules/server-ai/server-ai.module';
import configuration from './config/configuration';
import { resolveEnvFilePath } from './config/env-file.config';
import { AuditSubscriber } from './database/subscribers/audit.subscriber';
import { getTypeOrmConfig } from './database/typeorm.config';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AdminConsultantOnboardingModule } from './modules/admin-consultant-onboarding/admin-consultant-onboarding.module';
import { AdminConsultantSkillExamModule } from './modules/admin-consultant-skill-exam/admin-consultant-skill-exam.module';
import { AdminOnboardingQuestionsModule } from './modules/admin-onboarding-questions/admin-onboarding-questions.module';
import { AiBootstrapModule } from './modules/ai-bootstrap/ai-bootstrap.module';
import { AiProviderKeyModule } from './modules/ai-provider-key/ai-provider-key.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { BusinessOnboardingModule } from './modules/business-onboarding/business-onboarding.module';
import { BusinessProjectsModule } from './modules/business-projects/business-projects.module';
import { ConsultantOnboardingModule } from './modules/consultant-onboarding/consultant-onboarding.module';
import { ConsultantProjectsModule } from './modules/consultant-projects/consultant-projects.module';
import { ConsultantSkillExamModule } from './modules/consultant-skill-exam/consultant-skill-exam.module';
import { ExploreModule } from './modules/explore/explore.module';
import { FilesModule } from './modules/files';
import { HealthModule } from './modules/health/health.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { ProjectAiContextModule } from './modules/project-ai-context/project-ai-context.module';
import { ProjectChatSessionModule } from './modules/project-chat-session/project-chat-session.module';
import { SkillsModule } from './modules/skills/skills.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { TaskReviewsModule } from './modules/task-reviews/task-reviews.module';
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
    WinstonModule.forRoot(appWinstonOptions),
    EnvironmentsModule,
    TypeOrmModule.forRootAsync({
      imports: [EnvironmentsModule],
      inject: [EnvironmentsService],
      useFactory: (envService: EnvironmentsService) => getTypeOrmConfig(envService),
    }),
    I18nModule,
    ScheduleModule.forRoot(),
    // Bull (housekeeping queue) shares Redis with the rest of the app via the
    // existing connection settings; Bull manages its own keyspace under the
    // `bull:<queue>:` prefix so it doesn't collide with `RedisService` keys.
    BullModule.forRootAsync({
      imports: [EnvironmentsModule],
      inject: [EnvironmentsService],
      useFactory: (env: EnvironmentsService) => ({
        redis: {
          host: env.redisHost,
          port: env.redisPort,
          password: env.redisPassword,
          db: env.redisDb,
          tls: env.redisTlsEnabled ? {} : undefined,
          // Bull's BLPOP-based wait loop needs `maxRetriesPerRequest: null`
          // when the connection should hold a long-lived blocking call.
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        },
      }),
    }),
    EventEmitterModule.forRoot({ wildcard: false }),
    RequestContextModule,
    EmailModule,
    CopyleaksModule,
    RedisModule,
    PaymentModule,
    UnitOfWorkModule,
    AwsS3Module,
    FileStorageModule,
    AiBootstrapModule,
    AiProviderKeyModule,
    ServerAiModule,
    AdminAuthModule,
    AuthModule,
    BillingModule,
    BusinessOnboardingModule,
    BusinessProjectsModule,
    AdminConsultantOnboardingModule,
    AdminConsultantSkillExamModule,
    AdminOnboardingQuestionsModule,
    ConsultantOnboardingModule,
    ConsultantSkillExamModule,
    ConsultantProjectsModule,
    ExploreModule,
    FilesModule,
    HealthModule,
    HousekeepingModule,
    NotificationsModule,
    PaymentsModule,
    ProfilesModule,
    ProjectAiContextModule,
    ProjectChatSessionModule,
    SkillsModule,
    StatisticsModule,
    TaskReviewsModule,
    UsersModule,
    WebhooksModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    // Order matters: IdempotencyInterceptor must run BEFORE TransformResponse
    // so it captures (and replays) the raw controller payload, not the
    // already-wrapped StandardizedResponse envelope. Nest applies global
    // interceptors in registration order on the way in, reverse on the way
    // out — first listed wraps last.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
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

    consumer.apply(HttpLoggerMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });

    // JwtContextMiddleware runs after RequestContextMiddleware so the AsyncLocalStorage
    // context is already established when the JWT payload is written into it.
    consumer.apply(JwtContextMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
