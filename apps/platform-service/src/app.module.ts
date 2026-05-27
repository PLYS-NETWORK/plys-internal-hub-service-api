import { FilesModule } from '@modules/files';
import { FilesController } from '@modules/files/files.controller';
import { HealthController } from '@modules/health/health.controller';
import { HealthModule } from '@modules/health/health.module';
import { HousekeepingModule } from '@modules/housekeeping/housekeeping.module';
import { NotificationsController } from '@modules/notifications/notifications.controller';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { SkillsController } from '@modules/skills/skills.controller';
import { SkillsModule } from '@modules/skills/skills.module';
import { AdminStatisticsController } from '@modules/statistics/admin/admin-statistics.controller';
import { BusinessDashboardController } from '@modules/statistics/business/dashboard/business-dashboard.controller';
import { ConsultantDashboardController } from '@modules/statistics/consultant/dashboard/consultant-dashboard.controller';
import { StatisticsModule } from '@modules/statistics/statistics.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwsS3Module } from '@plys/libraries/common-nest/modules/aws-s3';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import { FileStorageModule } from '@plys/libraries/common-nest/modules/file-storage';
import { I18nModule } from '@plys/libraries/common-nest/modules/i18n';
import { appWinstonOptions } from '@plys/libraries/common-nest/modules/logger';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis';
import { RequestContextModule } from '@plys/libraries/common-nest/modules/request-context';
import configuration from '@plys/libraries/config/configuration';
import { resolveEnvFilePath } from '@plys/libraries/config/env-file.config';
import { AuditSubscriber } from '@plys/libraries/database/subscribers/audit.subscriber';
import { getTypeOrmConfig } from '@plys/libraries/database/typeorm.config';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';
import { WinstonModule } from 'nest-winston';

import {
  FilesGrpcController,
  GrpcModule,
  HealthGrpcController,
  NotificationsGrpcController,
  SkillsGrpcController,
  StatisticsGrpcController,
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
    AwsS3Module,
    FileStorageModule,
    UnitOfWorkModule,
    JwtModule.register({}),
    FilesModule,
    SkillsModule,
    StatisticsModule,
    NotificationsModule,
    HealthModule,
    HousekeepingModule,
    GrpcModule,
  ],
  providers: [AuditSubscriber],
  controllers: [
    HealthGrpcController,
    FilesGrpcController,
    SkillsGrpcController,
    StatisticsGrpcController,
    NotificationsGrpcController,
    FilesController,
    SkillsController,
    AdminStatisticsController,
    BusinessDashboardController,
    ConsultantDashboardController,
    NotificationsController,
    HealthController,
  ],
})
export class AppModule {}
