import { Module } from '@nestjs/common';
import { ProfilesUnitOfWorkModule } from '@plys/libraries/unit-of-work/profiles-unit-of-work.module';

import { BusinessProfilesService } from './business-profiles.service';
import { BusinessProfilesAdminService } from './business-profiles-admin.service';

@Module({
  imports: [ProfilesUnitOfWorkModule],
  controllers: [],
  providers: [BusinessProfilesService, BusinessProfilesAdminService],
  exports: [BusinessProfilesService, BusinessProfilesAdminService],
})
export class ProfilesModule {}
