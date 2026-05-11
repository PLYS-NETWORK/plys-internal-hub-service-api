import { PaymentModule } from '@common/modules/payment/payment.module';
import { BillingModule } from '@modules/billing/billing.module';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { WebhookProcessorService } from './webhook-processor.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [UnitOfWorkModule, PaymentModule, BillingModule],
  controllers: [WebhooksController],
  providers: [WebhookProcessorService],
})
export class WebhooksModule {}
