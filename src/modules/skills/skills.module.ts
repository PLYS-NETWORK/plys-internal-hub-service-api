import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [SkillsController],
  providers: [SkillsService],
})
export class SkillsModule {}
