import { HealthController } from '@modules/health/health.controller';
import { NotificationsController } from '@modules/notifications/notifications.controller';
import { SkillsController } from '@modules/skills/skills.controller';
import { AdminStatisticsController } from '@modules/statistics/admin/admin-statistics.controller';
import { BusinessDashboardController } from '@modules/statistics/business/dashboard/business-dashboard.controller';
import { ConsultantDashboardController } from '@modules/statistics/consultant/dashboard/consultant-dashboard.controller';
import { Module } from '@nestjs/common';
import { FileContentValidator } from '@plys/libraries/common-nest/modules/file-storage';

import { PlatformClientsModule } from '@/clients/platform';

import { gatewayJwtAuthImports } from '../shared/gateway-http-auth.providers';
import { PlatformFilesController } from './files.controller';
import { NotificationsGateway } from './notifications.gateway';
import { PLATFORM_HTTP_PROVIDERS } from './platform-http.providers';

@Module({
  imports: [PlatformClientsModule, ...gatewayJwtAuthImports],
  controllers: [
    PlatformFilesController,
    SkillsController,
    BusinessDashboardController,
    ConsultantDashboardController,
    AdminStatisticsController,
    NotificationsController,
    HealthController,
  ],
  providers: [...PLATFORM_HTTP_PROVIDERS, FileContentValidator, NotificationsGateway],
})
export class PlatformHttpModule {}
