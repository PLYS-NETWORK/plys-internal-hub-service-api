import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ConsultantApplicationController } from './consultant-application.controller';
import { ConsultantApplicationService } from './services/consultant-application.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [ConsultantApplicationController],
  providers: [ConsultantApplicationService],
})
export class ApplicationsModule {}
