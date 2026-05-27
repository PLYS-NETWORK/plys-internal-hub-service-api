import { BillingController } from '@modules/billing/billing.controller';
import { BillingModule } from '@modules/billing/billing.module';
import { PaymentsModule } from '@modules/payments';
import { AdminPaymentsController } from '@modules/payments/admin/admin-payments.controller';
import { BusinessPaymentsController } from '@modules/payments/business/business-payments.controller';
import { ConsultantPaymentsController } from '@modules/payments/consultant/consultant-payments.controller';
import { PaymentsController } from '@modules/payments/payments.controller';
import { WebhooksModule } from '@modules/webhooks/webhooks.module';
import { Module } from '@nestjs/common';
import { controllerProvider } from '@plys/libraries/common-nest/grpc';

import { BillingGrpcController } from './billing.grpc-controller';
import { PaymentsGrpcController } from './payments.grpc-controller';
import { WebhooksGrpcController } from './webhooks.grpc-controller';

@Module({
  imports: [PaymentsModule, BillingModule, WebhooksModule],
  controllers: [PaymentsGrpcController, BillingGrpcController, WebhooksGrpcController],
  providers: [
    controllerProvider(PaymentsController),
    controllerProvider(BusinessPaymentsController),
    controllerProvider(ConsultantPaymentsController),
    controllerProvider(AdminPaymentsController),
    controllerProvider(BillingController),
  ],
  exports: [PaymentsGrpcController, BillingGrpcController, WebhooksGrpcController],
})
export class GrpcModule {}
