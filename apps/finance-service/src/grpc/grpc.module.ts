import { BillingModule } from '@modules/billing/billing.module';
import { PaymentsModule } from '@modules/payments';
import { WebhooksModule } from '@modules/webhooks/webhooks.module';
import { Module } from '@nestjs/common';

/** Feature imports for gRPC bridge HTTP controllers registered on AppModule. */
@Module({
  imports: [PaymentsModule, BillingModule, WebhooksModule],
})
export class GrpcModule {}
