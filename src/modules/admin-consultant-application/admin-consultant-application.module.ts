import { CONSULTANT_APPLICATION_QUEUE } from '@modules/consultant-application/consultant-application.constants';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { AdminConsultantApplicationController } from './controllers/admin-consultant-application.controller';
import { AdminInterviewQuestionController } from './controllers/admin-interview-question.controller';
import { AdminApplicationService } from './services/admin-application.service';
import { AdminEvaluationService } from './services/admin-evaluation.service';
import { InterviewQuestionBankService } from './services/interview-question-bank.service';

// BullModule.registerQueue is idempotent — registering the same queue name here
// and in ConsultantApplicationModule is safe; both modules share the same Bull queue.
// ServerAiModule is @Global() — imported once in AppModule; no need to re-import here.
@Module({
  imports: [UnitOfWorkModule, BullModule.registerQueue({ name: CONSULTANT_APPLICATION_QUEUE })],
  controllers: [AdminConsultantApplicationController, AdminInterviewQuestionController],
  providers: [AdminApplicationService, AdminEvaluationService, InterviewQuestionBankService],
})
export class AdminConsultantApplicationModule {}
