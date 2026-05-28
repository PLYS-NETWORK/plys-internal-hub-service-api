import { BillingModule } from '@modules/billing/billing.module';
import { PaymentsModule } from '@modules/payments';
import { WebhooksModule } from '@modules/webhooks/webhooks.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '@plys/libraries/common-nest/modules/email';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import { I18nModule } from '@plys/libraries/common-nest/modules/i18n';
import { appWinstonOptions } from '@plys/libraries/common-nest/modules/logger';
import { PaymentModule } from '@plys/libraries/common-nest/modules/payment';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis';
import { RequestContextModule } from '@plys/libraries/common-nest/modules/request-context';
import configuration from '@plys/libraries/config/configuration';
import { resolveEnvFilePath } from '@plys/libraries/config/env-file.config';
import { AuditSubscriber } from '@plys/libraries/database/subscribers/audit.subscriber';
import { getTypeOrmConfig } from '@plys/libraries/database/typeorm.config';
import { NotificationsDispatchModule } from '@plys/libraries/notifications';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';
import { WinstonModule } from 'nest-winston';

import {
  BillingGrpcController,
  GRPC_HTTP_PROVIDERS,
  GrpcModule,
  HealthGrpcController,
  PaymentsGrpcController,
  WebhooksGrpcController,
} from './grpc';

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
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        },
      }),
    }),
    EventEmitterModule.forRoot({ wildcard: false }),
    ScheduleModule.forRoot(),
    I18nModule,
    RequestContextModule,
    RedisModule,
    EmailModule,
    PaymentModule,
    UnitOfWorkModule,
    JwtModule.register({}),
    NotificationsDispatchModule,
    BillingModule,
    PaymentsModule,
    WebhooksModule,
    GrpcModule,
  ],
  providers: [AuditSubscriber, ...GRPC_HTTP_PROVIDERS],
  controllers: [
    HealthGrpcController,
    PaymentsGrpcController,
    BillingGrpcController,
    WebhooksGrpcController,
  ],
})
export class AppModule {}
