import { BillingController } from '@modules/billing/billing.controller';
import { AdminPaymentsController } from '@modules/payments/admin/admin-payments.controller';
import { BusinessPaymentsController } from '@modules/payments/business/business-payments.controller';
import { ConsultantPaymentsController } from '@modules/payments/consultant/consultant-payments.controller';
import { PaymentsController } from '@modules/payments/payments.controller';
import { Module } from '@nestjs/common';

import { FinanceClientsModule } from '@/clients/finance';

import { FINANCE_HTTP_PROVIDERS } from './finance-http.providers';
import { FinanceWebhooksController } from './webhooks.controller';

@Module({
  imports: [FinanceClientsModule],
  controllers: [
    PaymentsController,
    BusinessPaymentsController,
    ConsultantPaymentsController,
    AdminPaymentsController,
    BillingController,
    FinanceWebhooksController,
  ],
  providers: FINANCE_HTTP_PROVIDERS,
})
export class FinanceHttpModule {}
