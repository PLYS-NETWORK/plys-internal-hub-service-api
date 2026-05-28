import { Module } from '@nestjs/common';

import { BusinessClientsModule } from '@/clients/v1/business';

import { BUSINESS_HTTP_PROVIDERS } from './business-http.providers';
import { AiSyncController } from './controllers/ai-sync.controller';
import { BacklogsController } from './controllers/backlogs.controller';
import { BoardController } from './controllers/board.controller';
import { BusinessDashboardController } from './controllers/business-dashboard.controller';
import { BusinessOnboardingController } from './controllers/business-onboarding.controller';
import { BusinessProfilesController } from './controllers/business-profiles.controller';
import { BusinessProfilesAdminController } from './controllers/business-profiles-admin.controller';
import { BusinessProjectOverviewController } from './controllers/overview.controller';
import { BusinessProjectsController } from './controllers/projects.controller';
import { SettingsController } from './controllers/settings.controller';
import { TaskAttachmentsController } from './controllers/task-attachments.controller';

@Module({
  imports: [BusinessClientsModule],
  controllers: [
    BusinessProfilesController,
    BusinessProfilesAdminController,
    BusinessOnboardingController,
    BusinessProjectsController,
    BusinessProjectOverviewController,
    BoardController,
    BacklogsController,
    SettingsController,
    TaskAttachmentsController,
    AiSyncController,
    BusinessDashboardController,
  ],
  providers: BUSINESS_HTTP_PROVIDERS,
})
export class BusinessHttpModule {}
