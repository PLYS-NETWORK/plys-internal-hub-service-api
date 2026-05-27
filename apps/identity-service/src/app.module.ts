import { AdminAuthModule } from '@modules/admin-auth/admin-auth.module';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { getTypeOrmConfig } from '@plys/libraries/database/typeorm.config';
import { NotificationsModule } from '@plys/libraries/notifications';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';
import { WinstonModule } from 'nest-winston';

import {
  AdminAllowedEmailsGrpcController,
  AdminAuthGrpcController,
  AuthGrpcController,
  HealthGrpcController,
  SessionGrpcController,
  UsersGrpcController,
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
    I18nModule,
    RequestContextModule,
    RedisModule,
    EmailModule,
    UnitOfWorkModule,
    JwtModule.register({}),
    EventEmitterModule.forRoot({ wildcard: false }),
    NotificationsModule,
    UsersModule,
    AuthModule,
    AdminAuthModule,
  ],
  controllers: [
    SessionGrpcController,
    HealthGrpcController,
    AuthGrpcController,
    AdminAuthGrpcController,
    UsersGrpcController,
    AdminAllowedEmailsGrpcController,
  ],
})
export class AppModule {}
