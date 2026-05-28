import { AiBootstrapModule } from '@modules/ai-bootstrap/ai-bootstrap.module';
import { AiProviderKeyModule } from '@modules/ai-provider-key/ai-provider-key.module';
import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { ProjectChatSessionModule } from '@modules/project-chat-session/project-chat-session.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GrpcIdempotencyService } from '@plys/libraries/common-nest/grpc';
import {
  EnvironmentsModule,
  EnvironmentsService,
} from '@plys/libraries/common-nest/modules/environments';
import { I18nModule } from '@plys/libraries/common-nest/modules/i18n';
import { appWinstonOptions } from '@plys/libraries/common-nest/modules/logger';
import { RedisModule } from '@plys/libraries/common-nest/modules/redis';
import { RequestContextModule } from '@plys/libraries/common-nest/modules/request-context';
import { resolveEnvFilePath } from '@plys/libraries/config/env-file.config';
import { AuditSubscriber } from '@plys/libraries/database/subscribers/audit.subscriber';
import { getTypeOrmConfig } from '@plys/libraries/database/typeorm.config';
import { WinstonModule } from 'nest-winston';

import {
  AiProviderKeysGrpcController,
  ChatSessionsGrpcController,
  GRPC_HTTP_PROVIDERS,
  GrpcModule,
  HealthGrpcController,
  ProjectAiContextGrpcController,
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
    I18nModule,
    RequestContextModule,
    RedisModule,
    AppUnitOfWorkModule,
    JwtModule.register({}),
    AiProviderKeyModule,
    ProjectAiContextModule,
    ProjectChatSessionModule,
    AiBootstrapModule,
    GrpcModule,
  ],
  providers: [AuditSubscriber, GrpcIdempotencyService, ...GRPC_HTTP_PROVIDERS],
  controllers: [
    HealthGrpcController,
    AiProviderKeysGrpcController,
    ProjectAiContextGrpcController,
    ChatSessionsGrpcController,
  ],
})
export class AppModule {}
