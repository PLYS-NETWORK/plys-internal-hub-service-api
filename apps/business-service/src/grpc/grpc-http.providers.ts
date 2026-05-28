import { BusinessOnboardingController } from '@modules/business-onboarding/controllers/business-onboarding.controller';
import { AiSyncController } from '@modules/business-projects/controllers/ai-sync.controller';
import { BacklogsController } from '@modules/business-projects/controllers/backlogs.controller';
import { BoardController } from '@modules/business-projects/controllers/board.controller';
import { BusinessProjectOverviewController } from '@modules/business-projects/controllers/overview.controller';
import { BusinessProjectsController } from '@modules/business-projects/controllers/projects.controller';
import { SettingsController } from '@modules/business-projects/controllers/settings.controller';
import { TaskAttachmentsController } from '@modules/business-projects/controllers/task-attachments.controller';
import { BusinessProfilesController } from '@modules/profiles/business-profiles.controller';
import { BusinessProfilesAdminController } from '@modules/profiles/business-profiles-admin.controller';
import { BusinessDashboardController } from '@modules/statistics/business/dashboard/business-dashboard.controller';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

export const GRPC_HTTP_PROVIDERS = [
  controllerProvider(BusinessProfilesController),
  controllerProvider(BusinessProfilesAdminController),
  controllerProvider(BusinessOnboardingController),
  controllerProvider(BusinessProjectsController),
  controllerProvider(BusinessProjectOverviewController),
  controllerProvider(BoardController),
  controllerProvider(BacklogsController),
  controllerProvider(SettingsController),
  controllerProvider(TaskAttachmentsController),
  controllerProvider(AiSyncController),
  controllerProvider(BusinessDashboardController),
];
