import { NotificationsModule } from '@modules/notifications/notifications.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { BusinessProfilesController } from './business/business-profiles.controller';
import { BusinessProfilesService } from './business/business-profiles.service';
import { BusinessProfilesAdminController } from './business/business-profiles-admin.controller';
import { BusinessProfilesAdminService } from './business/business-profiles-admin.service';
import { ConsultantProfilesController } from './consultant/consultant-profiles.controller';
import { ConsultantProfilesService } from './consultant/consultant-profiles.service';
import { ConsultantProfilesAdminController } from './consultant/consultant-profiles-admin.controller';
import { ConsultantProfilesAdminService } from './consultant/consultant-profiles-admin.service';
import { ConsultantSkillsService } from './consultant/consultant-skills.service';

@Module({
  imports: [UnitOfWorkModule, NotificationsModule],
  controllers: [
    BusinessProfilesController,
    BusinessProfilesAdminController,
    ConsultantProfilesController,
    ConsultantProfilesAdminController,
  ],
  providers: [
    BusinessProfilesService,
    BusinessProfilesAdminService,
    ConsultantProfilesService,
    ConsultantProfilesAdminService,
    ConsultantSkillsService,
  ],
})
export class ProfilesModule {}
