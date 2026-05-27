import { AiBootstrapController } from '@modules/ai-bootstrap/ai-bootstrap.controller';
import { AiBootstrapModule } from '@modules/ai-bootstrap/ai-bootstrap.module';
import { BusinessProjectsModule } from '@modules/business-projects/business-projects.module';
import { AiSyncController } from '@modules/business-projects/controllers/ai-sync.controller';
import { BacklogsController } from '@modules/business-projects/controllers/backlogs.controller';
import { BoardController } from '@modules/business-projects/controllers/board.controller';
import { BusinessProjectOverviewController } from '@modules/business-projects/controllers/overview.controller';
import { BusinessProjectsController } from '@modules/business-projects/controllers/projects.controller';
import { SettingsController } from '@modules/business-projects/controllers/settings.controller';
import { TaskAttachmentsController } from '@modules/business-projects/controllers/task-attachments.controller';
import { ConsultantProjectsModule } from '@modules/consultant-projects/consultant-projects.module';
import { ConsultantExploreController } from '@modules/consultant-projects/controllers/consultant-explore.controller';
import { ConsultantJoinedProjectsController } from '@modules/consultant-projects/controllers/consultant-joined-projects.controller';
import { ConsultantMembershipController } from '@modules/consultant-projects/controllers/consultant-membership.controller';
import { ConsultantProjectTasksController } from '@modules/consultant-projects/controllers/consultant-project-tasks.controller';
import { ExploreController } from '@modules/explore/explore.controller';
import { ExploreModule } from '@modules/explore/explore.module';
import { ProjectAiContextController } from '@modules/project-ai-context/project-ai-context.controller';
import { ProjectAiContextModule } from '@modules/project-ai-context/project-ai-context.module';
import { ProjectAiContextAdminController } from '@modules/project-ai-context/project-ai-context-admin.controller';
import { ChatSessionsController } from '@modules/project-chat-session/controllers/chat-sessions.controller';
import { ProjectSessionsController } from '@modules/project-chat-session/controllers/project-sessions.controller';
import { ProjectChatSessionModule } from '@modules/project-chat-session/project-chat-session.module';
import { TaskReviewsController } from '@modules/task-reviews/task-reviews.controller';
import { TaskReviewsModule } from '@modules/task-reviews/task-reviews.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProviderKeyModule } from '@plys/libraries/ai-provider-key';
import { AiProviderKeyAdminController } from '@plys/libraries/ai-provider-key';
import { AiProviderKeyBffController } from '@plys/libraries/ai-provider-key';
import { GrpcIdempotencyService } from '@plys/libraries/common-nest/grpc';
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
  providers: [AuditSubscriber, GrpcIdempotencyService],
  controllers: [
    HealthGrpcController,
    BusinessProjectsGrpcController,
    ConsultantProjectsGrpcController,
    ExploreGrpcController,
    TaskReviewsGrpcController,
    AiProviderKeysGrpcController,
    ProjectAiContextGrpcController,
    ChatSessionsGrpcController,
    BusinessProjectsController,
    BusinessProjectOverviewController,
    BoardController,
    BacklogsController,
    SettingsController,
    TaskAttachmentsController,
    AiSyncController,
    ConsultantJoinedProjectsController,
    ConsultantExploreController,
    ConsultantMembershipController,
    ConsultantProjectTasksController,
    ExploreController,
    TaskReviewsController,
    AiProviderKeyAdminController,
    AiProviderKeyBffController,
    ProjectAiContextController,
    ProjectAiContextAdminController,
    AiBootstrapController,
    ProjectSessionsController,
    ChatSessionsController,
  ],
})
export class AppModule {}
