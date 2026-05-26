import { BillingModule } from '@modules/billing/billing.module';
import { Module } from '@nestjs/common';
import { PaymentModule } from '@plys/libraries/common-nest/modules/payment/payment.module';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { WebhookProcessorService } from './webhook-processor.service';

@Module({
  imports: [UnitOfWorkModule, PaymentModule, BillingModule],
  controllers: [],
  providers: [WebhookProcessorService],
})
export class WebhooksModule {}
