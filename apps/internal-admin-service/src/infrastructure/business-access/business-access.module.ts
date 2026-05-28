import { Module } from '@nestjs/common';
import { ProjectsUnitOfWorkModule } from '@plys/libraries/unit-of-work/projects-unit-of-work.module';

import { ProfilesPortModule } from '../profiles-port/profiles-port.module';
import { BusinessAccessService } from './business-access.service';

@Module({
  imports: [ProjectsUnitOfWorkModule, ProfilesPortModule],
  providers: [BusinessAccessService],
  exports: [BusinessAccessService],
})
export class BusinessAccessModule {}
