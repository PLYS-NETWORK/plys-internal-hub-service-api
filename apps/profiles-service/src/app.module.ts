import { AdminConsultantOnboardingModule } from '@modules/admin-consultant-onboarding/admin-consultant-onboarding.module';
import { AdminConsultantOnboardingController } from '@modules/admin-consultant-onboarding/controllers/admin-consultant-onboarding.controller';
import { AdminConsultantSkillExamModule } from '@modules/admin-consultant-skill-exam/admin-consultant-skill-exam.module';
import { AdminConsultantSkillExamController } from '@modules/admin-consultant-skill-exam/controllers/admin-consultant-skill-exam.controller';
import { AdminOnboardingQuestionsModule } from '@modules/admin-onboarding-questions/admin-onboarding-questions.module';
import { AdminOnboardingQuestionsController } from '@modules/admin-onboarding-questions/controllers/admin-onboarding-questions.controller';
import { BusinessOnboardingModule } from '@modules/business-onboarding/business-onboarding.module';
import { BusinessOnboardingController } from '@modules/business-onboarding/controllers/business-onboarding.controller';
import { ConsultantOnboardingModule } from '@modules/consultant-onboarding/consultant-onboarding.module';
import { ConsultantOnboardingController } from '@modules/consultant-onboarding/controllers/consultant-onboarding.controller';
import { ConsultantSkillExamModule } from '@modules/consultant-skill-exam/consultant-skill-exam.module';
import { ConsultantSkillExamController } from '@modules/consultant-skill-exam/controllers/consultant-skill-exam.controller';
import { BusinessProfilesController } from '@modules/profiles/business/business-profiles.controller';
import { BusinessProfilesAdminController } from '@modules/profiles/business/business-profiles-admin.controller';
import { ConsultantProfilesController } from '@modules/profiles/consultant/consultant-profiles.controller';
import { ConsultantProfilesAdminController } from '@modules/profiles/consultant/consultant-profiles-admin.controller';
import { ProfilesModule } from '@modules/profiles/profiles.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
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
import { getTypeOrmConfig } from '@plys/libraries/database/typeorm.config';
import { NotificationsModule } from '@plys/libraries/notifications';
import { ProfilesUnitOfWorkModule } from '@plys/libraries/unit-of-work/profiles-unit-of-work.module';
import { WinstonModule } from 'nest-winston';

import {
  AdminOnboardingGrpcController,
  BusinessOnboardingGrpcController,
  ConsultantOnboardingGrpcController,
  GrpcModule,
  HealthGrpcController,
  ProfilesGrpcController,
  SkillExamsGrpcController,
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
    AiProviderKeyModule,
    ProfilesUnitOfWorkModule,
    JwtModule.register({}),
    NotificationsModule,
    ProfilesModule,
    BusinessOnboardingModule,
    ConsultantOnboardingModule,
    AdminConsultantOnboardingModule,
    AdminOnboardingQuestionsModule,
    ConsultantSkillExamModule,
    AdminConsultantSkillExamModule,
    GrpcModule,
  ],
  controllers: [
    HealthGrpcController,
    ProfilesGrpcController,
    BusinessOnboardingGrpcController,
    ConsultantOnboardingGrpcController,
    AdminOnboardingGrpcController,
    SkillExamsGrpcController,
    BusinessProfilesController,
    BusinessProfilesAdminController,
    ConsultantProfilesController,
    ConsultantProfilesAdminController,
    BusinessOnboardingController,
    ConsultantOnboardingController,
    AdminConsultantOnboardingController,
    AdminOnboardingQuestionsController,
    ConsultantSkillExamController,
    AdminConsultantSkillExamController,
  ],
})
export class AppModule {}
