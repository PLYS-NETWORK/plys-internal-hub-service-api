import { Module } from '@nestjs/common';
import { PROFILES_LEDGER, PROFILES_READER } from '@plys/libraries/profiles-port';
import { ProjectsUnitOfWorkModule } from '@plys/libraries/unit-of-work/projects-unit-of-work.module';

import { SharedDbProfilesAdapter } from './shared-db-profiles.adapter';

@Module({
  imports: [ProjectsUnitOfWorkModule],
  providers: [
    SharedDbProfilesAdapter,
    { provide: PROFILES_READER, useExisting: SharedDbProfilesAdapter },
    { provide: PROFILES_LEDGER, useExisting: SharedDbProfilesAdapter },
  ],
  exports: [PROFILES_READER, PROFILES_LEDGER],
})
export class ProfilesPortModule {}
