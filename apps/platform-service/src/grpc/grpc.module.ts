import { FilesModule } from '@modules/files';
import { FilesController } from '@modules/files/files.controller';
import { HealthController } from '@modules/health/health.controller';
import { HealthModule } from '@modules/health/health.module';
import { NotificationsController } from '@modules/notifications/notifications.controller';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { SkillsController } from '@modules/skills/skills.controller';
import { SkillsModule } from '@modules/skills/skills.module';
import { AdminStatisticsController } from '@modules/statistics/admin/admin-statistics.controller';
import { BusinessDashboardController } from '@modules/statistics/business/dashboard/business-dashboard.controller';
import { ConsultantDashboardController } from '@modules/statistics/consultant/dashboard/consultant-dashboard.controller';
import { StatisticsModule } from '@modules/statistics/statistics.module';
import { Module } from '@nestjs/common';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

import { FilesGrpcController } from './files.grpc-controller';
import { HealthGrpcController } from './health.grpc-controller';
import { NotificationsGrpcController } from './notifications.grpc-controller';
import { SkillsGrpcController } from './skills.grpc-controller';
import { StatisticsGrpcController } from './statistics.grpc-controller';

@Module({
  imports: [FilesModule, SkillsModule, StatisticsModule, NotificationsModule, HealthModule],
  controllers: [
    FilesGrpcController,
    SkillsGrpcController,
    StatisticsGrpcController,
    NotificationsGrpcController,
    HealthGrpcController,
  ],
  providers: [
    controllerProvider(FilesController),
    controllerProvider(SkillsController),
    controllerProvider(AdminStatisticsController),
    controllerProvider(BusinessDashboardController),
    controllerProvider(ConsultantDashboardController),
    controllerProvider(NotificationsController),
    controllerProvider(HealthController),
  ],
})
export class GrpcModule {}
