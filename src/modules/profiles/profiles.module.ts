import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { BusinessProfilesController } from './business/business-profiles.controller';
import { BusinessProfilesService } from './business/business-profiles.service';
import { ConsultantProfilesController } from './consultant/consultant-profiles.controller';
import { ConsultantProfilesService } from './consultant/consultant-profiles.service';
import { ConsultantSkillsService } from './consultant/consultant-skills.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [BusinessProfilesController, ConsultantProfilesController],
  providers: [BusinessProfilesService, ConsultantProfilesService, ConsultantSkillsService],
})
export class ProfilesModule {}
