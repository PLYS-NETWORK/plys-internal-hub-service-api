import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { BusinessProfilesController } from './business-profiles.controller';
import { BusinessProfilesService } from './business-profiles.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [BusinessProfilesController],
  providers: [BusinessProfilesService],
})
export class BusinessProfilesModule {}
