import { ConsultantOnboardingModule } from '@modules/consultant-onboarding/consultant-onboarding.module';
import { ConsultantProjectsModule } from '@modules/consultant-projects/consultant-projects.module';
import { ConsultantSkillExamModule } from '@modules/consultant-skill-exam/consultant-skill-exam.module';
import { ExploreModule } from '@modules/explore/explore.module';
import { ProfilesModule } from '@modules/profiles/profiles.module';
import { StatisticsModule } from '@modules/statistics/statistics.module';
import { TaskReviewsModule } from '@modules/task-reviews/task-reviews.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwsS3Module } from '@plys/libraries/common-nest/modules/aws-s3';
import { EmailModule } from '@plys/libraries/common-nest/modules/email';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import { FileStorageModule } from '@plys/libraries/common-nest/modules/file-storage';
import { I18nModule } from '@plys/libraries/common-nest/modules/i18n';
import { appWinstonOptions } from '@plys/libraries/common-nest/modules/logger';
import { NotificationsClientModule } from '@plys/libraries/common-nest/modules/notifications-client/notifications-client.module';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis';
import { RequestContextModule } from '@plys/libraries/common-nest/modules/request-context';
import { resolveEnvFilePath } from '@plys/libraries/config/env-file.config';
import { AuditSubscriber } from '@plys/libraries/database/subscribers/audit.subscriber';
import { getTypeOrmConfig } from '@plys/libraries/database/typeorm.config';
import { WinstonModule } from 'nest-winston';

import {
  ConsultantOnboardingGrpcController,
  ConsultantProjectsGrpcController,
  ExploreGrpcController,
  GRPC_HTTP_PROVIDERS,
  GrpcModule,
  HealthGrpcController,
  ProfilesGrpcController,
  SkillExamsGrpcController,
  StatisticsGrpcController,
} from './grpc';
import { AppUnitOfWorkModule } from './infrastructure/uow/app-unit-of-work.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePath(),
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
    AppUnitOfWorkModule,
    JwtModule.register({}),
    AwsS3Module,
    FileStorageModule,
    EmailModule,
    NotificationsClientModule,
    ProfilesModule,
    ConsultantOnboardingModule,
    ConsultantSkillExamModule,
    ConsultantProjectsModule,
    ExploreModule,
    TaskReviewsModule,
    StatisticsModule,
    GrpcModule,
  ],
  providers: [AuditSubscriber, ...GRPC_HTTP_PROVIDERS],
  controllers: [
    HealthGrpcController,
    ProfilesGrpcController,
    ConsultantOnboardingGrpcController,
    SkillExamsGrpcController,
    ConsultantProjectsGrpcController,
    ExploreGrpcController,
    StatisticsGrpcController,
  ],
})
export class AppModule {}
