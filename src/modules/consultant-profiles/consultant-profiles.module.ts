import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ConsultantProfilesController } from './consultant-profiles.controller';
import { ConsultantProfilesService } from './consultant-profiles.service';
import { ConsultantSkillsService } from './services/consultant-skills.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [ConsultantProfilesController],
  providers: [ConsultantProfilesService, ConsultantSkillsService],
})
export class ConsultantProfilesModule {}
