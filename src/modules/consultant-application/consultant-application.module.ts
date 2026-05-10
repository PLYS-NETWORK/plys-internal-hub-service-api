import { CopyleaksModule } from '@common/modules/copyleaks';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { CONSULTANT_APPLICATION_QUEUE } from './consultant-application.constants';
import { ConsultantApplicationController } from './controllers/consultant-application.controller';
import { ConsultantApplicationProcessor } from './processors/consultant-application.processor';
import { AiEvaluationService } from './services/ai-evaluation.service';
import { ConsultantApplicationService } from './services/consultant-application.service';
import { CopyleaksEvaluationService } from './services/copyleaks-evaluation.service';
import { InterviewService } from './services/interview.service';

// ServerAiModule is @Global() — imported once in AppModule; no need to re-import here.
// Admin-facing routes and services live in AdminConsultantApplicationModule.
@Module({
  imports: [
    UnitOfWorkModule,
    CopyleaksModule,
    BullModule.registerQueue({ name: CONSULTANT_APPLICATION_QUEUE }),
  ],
  controllers: [ConsultantApplicationController],
  providers: [
    ConsultantApplicationService,
    InterviewService,
    CopyleaksEvaluationService,
    AiEvaluationService,
    ConsultantApplicationProcessor,
  ],
})
export class ConsultantApplicationModule {}
