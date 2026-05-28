import { FilesController } from '@modules/files/files.controller';
import { HealthController } from '@modules/health/health.controller';
import { NotificationsController } from '@modules/notifications/notifications.controller';
import { SkillsController } from '@modules/skills/skills.controller';
import { AdminStatisticsController } from '@modules/statistics/admin/admin-statistics.controller';
import { BusinessDashboardController } from '@modules/statistics/business/dashboard/business-dashboard.controller';
import { ConsultantDashboardController } from '@modules/statistics/consultant/dashboard/consultant-dashboard.controller';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

// HTTP controllers are registered as injectable providers (not route handlers) so
// gRPC bridge controllers can delegate to them via constructor injection.
export const GRPC_HTTP_PROVIDERS = [
  controllerProvider(HealthController),
  controllerProvider(FilesController),
  controllerProvider(SkillsController),
  controllerProvider(AdminStatisticsController),
  controllerProvider(BusinessDashboardController),
  controllerProvider(ConsultantDashboardController),
  controllerProvider(NotificationsController),
];
