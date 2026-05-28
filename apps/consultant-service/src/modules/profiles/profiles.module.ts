import { Module } from '@nestjs/common';
import { ProfilesUnitOfWorkModule } from '@plys/libraries/unit-of-work/profiles-unit-of-work.module';

import { ConsultantProfilesService } from './consultant-profiles.service';
import { ConsultantProfilesAdminService } from './consultant-profiles-admin.service';
import { ConsultantSkillsService } from './consultant-skills.service';

@Module({
  imports: [ProfilesUnitOfWorkModule],
  controllers: [],
  providers: [ConsultantProfilesService, ConsultantProfilesAdminService, ConsultantSkillsService],
  exports: [ConsultantProfilesService, ConsultantProfilesAdminService, ConsultantSkillsService],
})
export class ProfilesModule {}
