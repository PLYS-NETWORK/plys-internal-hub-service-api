import { NotificationsModule } from '@modules/notifications/notifications.module';
import { Module } from '@nestjs/common';
import { ProfilesUnitOfWorkModule } from '@plys/libraries/unit-of-work/profiles-unit-of-work.module';

import { BusinessProfilesService } from './business/business-profiles.service';
import { BusinessProfilesAdminService } from './business/business-profiles-admin.service';
import { ConsultantProfilesService } from './consultant/consultant-profiles.service';
import { ConsultantProfilesAdminService } from './consultant/consultant-profiles-admin.service';
import { ConsultantSkillsService } from './consultant/consultant-skills.service';

@Module({
  imports: [ProfilesUnitOfWorkModule, NotificationsModule],
  controllers: [],
  providers: [
    BusinessProfilesService,
    BusinessProfilesAdminService,
    ConsultantProfilesService,
    ConsultantProfilesAdminService,
    ConsultantSkillsService,
  ],
})
export class ProfilesModule {}
