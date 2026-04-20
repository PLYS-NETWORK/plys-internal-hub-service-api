import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { BusinessApplicationController } from './business-application.controller';
import { ConsultantApplicationController } from './consultant-application.controller';
import { BusinessApplicationService } from './services/business-application.service';
import { ConsultantApplicationService } from './services/consultant-application.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [BusinessApplicationController, ConsultantApplicationController],
  providers: [BusinessApplicationService, ConsultantApplicationService],
})
export class ApplicationsModule {}
