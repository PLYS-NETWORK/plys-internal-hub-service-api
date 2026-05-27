import { Module } from '@nestjs/common';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { SkillsService } from './skills.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
