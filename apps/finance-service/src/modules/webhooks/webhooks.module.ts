import { BillingModule } from '@modules/billing/billing.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { PaymentModule } from '@plys/libraries/common-nest/modules/payment/payment.module';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { WEBHOOK_QUEUE } from './queues/webhook-queue.constants';
import { WebhookQueueProcessor } from './queues/webhook-queue.processor';
import { WebhookQueueService } from './queues/webhook-queue.service';
import { WebhookProcessorService } from './webhook-processor.service';

@Module({
  imports: [
    UnitOfWorkModule,
    PaymentModule,
    BillingModule,
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
  ],
  controllers: [],
  providers: [WebhookProcessorService, WebhookQueueService, WebhookQueueProcessor],
  exports: [WebhookProcessorService, WebhookQueueService],
})
export class WebhooksModule {}
