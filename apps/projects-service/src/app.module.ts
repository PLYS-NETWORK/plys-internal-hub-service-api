import { AiBootstrapModule } from '@modules/ai-bootstrap/ai-bootstrap.module';
import { BusinessProjectsModule } from '@modules/business-projects/business-projects.module';
import { ConsultantProjectsModule } from '@modules/consultant-projects/consultant-projects.module';
import { ExploreModule } from '@modules/explore/explore.module';
import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { ProjectChatSessionModule } from '@modules/project-chat-session/project-chat-session.module';
import { TaskReviewsModule } from '@modules/task-reviews/task-reviews.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProviderKeyModule } from '@plys/libraries/ai-provider-key';
import { EmailModule } from '@plys/libraries/common-nest/modules/email';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import { I18nModule } from '@plys/libraries/common-nest/modules/i18n';
import { appWinstonOptions } from '@plys/libraries/common-nest/modules/logger';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis';
import { RequestContextModule } from '@plys/libraries/common-nest/modules/request-context';
import configuration from '@plys/libraries/config/configuration';
import { resolveEnvFilePath } from '@plys/libraries/config/env-file.config';
import { AuditSubscriber } from '@plys/libraries/database/subscribers/audit.subscriber';
import { getTypeOrmConfig } from '@plys/libraries/database/typeorm.config';
import { NotificationsModule } from '@plys/libraries/notifications';
import { ProjectsUnitOfWorkModule } from '@plys/libraries/unit-of-work/projects-unit-of-work.module';
import { WinstonModule } from 'nest-winston';

import {
  AiProviderKeysGrpcController,
  BusinessProjectsGrpcController,
  ChatSessionsGrpcController,
  ConsultantProjectsGrpcController,
  ExploreGrpcController,
  GrpcModule,
  HealthGrpcController,
  ProjectAiContextGrpcController,
  TaskReviewsGrpcController,
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
    I18nModule,
    RequestContextModule,
    RedisModule,
    EmailModule,
    ProjectsUnitOfWorkModule,
    JwtModule.register({}),
    NotificationsModule,
    BusinessProjectsModule,
    ProjectAiContextModule,
    ProjectChatSessionModule,
    AiBootstrapModule,
    ConsultantProjectsModule,
    ExploreModule,
    TaskReviewsModule,
    AiProviderKeyModule,
    GrpcModule,
  ],
  providers: [AuditSubscriber],
  controllers: [
    HealthGrpcController,
    BusinessProjectsGrpcController,
    ConsultantProjectsGrpcController,
    ExploreGrpcController,
    TaskReviewsGrpcController,
    AiProviderKeysGrpcController,
    ProjectAiContextGrpcController,
    ChatSessionsGrpcController,
  ],
})
export class AppModule {}
